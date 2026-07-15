import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  eventTypeId: z.string().uuid(),
  startISO: z.string(),
  notes: z.string().max(2000).optional(),
});

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: et, error: etErr } = await supabase
      .from("event_types")
      .select("*")
      .eq("id", data.eventTypeId)
      .maybeSingle();
    if (etErr || !et) throw new Error("Event type not found");
    if (!et.active) throw new Error("This event type is not accepting bookings");

    const startMs = new Date(data.startISO).getTime();
    const endMs = startMs + et.duration_min * 60_000;
    const startISO = new Date(startMs).toISOString();
    const endISO = new Date(endMs).toISOString();

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile missing");

    // Look up existing booking at same start (for group slots)
    const { data: existing } = await supabase
      .from("bookings")
      .select("id, google_event_id, booking_attendees(user_id, email, full_name)")
      .eq("event_type_id", et.id)
      .eq("start_at", startISO)
      .maybeSingle();

    const google = await import("./google-calendar.server");

    if (existing) {
      const attendees = existing.booking_attendees ?? [];
      if (attendees.some((a: { user_id: string | null }) => a.user_id === userId))
        throw new Error("You're already registered for this slot");
      if (attendees.length >= et.capacity) throw new Error("This slot is full");

      const { error: attErr } = await supabase.from("booking_attendees").insert({
        booking_id: existing.id,
        user_id: userId,
        email: profile.email,
        full_name: profile.full_name,
        notes: data.notes,
      });
      if (attErr) throw new Error(attErr.message);

      // Update Google event attendees
      if (existing.google_event_id) {
        const newList = [
          ...attendees.map((a: { email: string; full_name: string | null }) => ({
            email: a.email,
            displayName: a.full_name ?? undefined,
          })),
          { email: profile.email, displayName: profile.full_name ?? undefined },
        ];
        await google.patchAttendees(existing.google_event_id, newList);
      }
      return { bookingId: existing.id };
    }

    // New booking: create Google event first (if connected)
    const gEventId = await google.createCalendarEvent({
      summary: et.title,
      description: et.description ?? undefined,
      startISO,
      endISO,
      attendees: [{ email: profile.email, displayName: profile.full_name ?? undefined }],
    });

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .insert({
        event_type_id: et.id,
        start_at: startISO,
        end_at: endISO,
        google_event_id: gEventId,
      })
      .select("id")
      .single();
    if (bErr || !booking) throw new Error(bErr?.message ?? "Failed to create booking");

    const { error: attErr } = await supabase.from("booking_attendees").insert({
      booking_id: booking.id,
      user_id: userId,
      email: profile.email,
      full_name: profile.full_name,
      notes: data.notes,
    });
    if (attErr) throw new Error(attErr.message);

    return { bookingId: booking.id };
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) =>
    z.object({ bookingId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, google_event_id, booking_attendees(user_id, email, full_name)")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found");

    // Remove my attendee row
    const { error: delErr } = await supabase
      .from("booking_attendees")
      .delete()
      .eq("booking_id", data.bookingId)
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);

    const google = await import("./google-calendar.server");
    const remaining = (booking.booking_attendees ?? []).filter(
      (a: { user_id: string | null }) => a.user_id !== userId,
    );

    if (remaining.length === 0) {
      if (booking.google_event_id) await google.deleteCalendarEvent(booking.google_event_id);
      await supabase.from("bookings").delete().eq("id", data.bookingId);
    } else if (booking.google_event_id) {
      await google.patchAttendees(
        booking.google_event_id,
        remaining.map((a: { email: string; full_name: string | null }) => ({
          email: a.email,
          displayName: a.full_name ?? undefined,
        })),
      );
    }
    return { ok: true };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("booking_attendees")
      .select("id, notes, booking:bookings(id, start_at, end_at, event_type:event_types(title, slug, color, duration_min, capacity))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAllBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bookings")
      .select("id, start_at, end_at, event_type:event_types(title, color, capacity), attendees:booking_attendees(id, email, full_name, notes)")
      .order("start_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });