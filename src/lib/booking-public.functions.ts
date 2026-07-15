import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface PublicSlot {
  startISO: string;
  endISO: string;
  attendeeCount: number;
  full: boolean;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getPublicEventType = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("event_types")
      .select("id, title, slug, description, duration_min, capacity, buffer_before_min, buffer_after_min, min_notice_hours, max_days_ahead, color, active, owner_id")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getPublicSlots = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ eventTypeId: z.string().uuid(), dateISO: z.string() }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicSlot[]> => {
    const db = await admin();
    const { data: et } = await db
      .from("event_types")
      .select("*")
      .eq("id", data.eventTypeId)
      .eq("active", true)
      .maybeSingle();
    if (!et) return [];

    const { data: rules } = await db
      .from("availability_rules")
      .select("*")
      .eq("owner_id", et.owner_id);

    const [y, m, d] = data.dateISO.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const dayRules = (rules ?? []).filter((r) => r.weekday === weekday);
    if (dayRules.length === 0) return [];

    const dayStart = new Date(Date.UTC(y, m - 1, d));
    const dayEnd = new Date(Date.UTC(y, m - 1, d + 1));
    const now = new Date();
    const minStart = new Date(now.getTime() + et.min_notice_hours * 3600_000);
    const maxStart = new Date(now.getTime() + et.max_days_ahead * 86400_000);

    const { data: existingBookings } = await db
      .from("bookings")
      .select("id, start_at, end_at, booking_attendees(id)")
      .eq("event_type_id", et.id)
      .gte("start_at", dayStart.toISOString())
      .lt("start_at", dayEnd.toISOString());

    const ownBookingStarts = new Set(
      (existingBookings ?? []).map((b) => new Date(b.start_at).getTime()),
    );

    const { getBusyIntervals } = await import("./google-calendar.server");
    const rawBusy = await getBusyIntervals(dayStart.toISOString(), dayEnd.toISOString());
    // Exclude busy intervals created by our own bookings so group slots stay
    // visible after the first booking creates a Google event.
    const busy = rawBusy.filter((b) => !ownBookingStarts.has(new Date(b.start).getTime()));

    const slots: PublicSlot[] = [];
    const durMs = et.duration_min * 60_000;
    const bufBeforeMs = et.buffer_before_min * 60_000;
    const bufAfterMs = et.buffer_after_min * 60_000;

    for (const rule of dayRules) {
      const [sh, sm] = rule.start_time.split(":").map(Number);
      const [eh, em] = rule.end_time.split(":").map(Number);
      const winStart = Date.UTC(y, m - 1, d, sh, sm);
      const winEnd = Date.UTC(y, m - 1, d, eh, em);

      for (let t = winStart; t + durMs <= winEnd; t += durMs) {
        const s = new Date(t);
        if (s < minStart || s > maxStart) continue;

        const sBuf = t - bufBeforeMs;
        const eBuf = t + durMs + bufAfterMs;
        const googleConflict = busy.some((b) => {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return bs < eBuf && be > sBuf;
        });
        if (googleConflict) continue;

        const existing = (existingBookings ?? []).find(
          (b) => new Date(b.start_at).getTime() === t,
        );
        const attendeeCount = existing?.booking_attendees?.length ?? 0;
        const full = attendeeCount >= et.capacity;

        if (et.capacity === 1 && !existing) {
          const overlap = (existingBookings ?? []).some((b) => {
            const bs = new Date(b.start_at).getTime();
            const be = new Date(b.end_at).getTime();
            return bs < t + durMs && be > t;
          });
          if (overlap) continue;
        }

        slots.push({
          startISO: s.toISOString(),
          endISO: new Date(t + durMs).toISOString(),
          attendeeCount,
          full,
        });
      }
    }
    return slots;
  });

const createSchema = z.object({
  eventTypeId: z.string().uuid(),
  startISO: z.string(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  notes: z.string().max(2000).optional(),
});

export const createPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: et } = await db
      .from("event_types")
      .select("*")
      .eq("id", data.eventTypeId)
      .eq("active", true)
      .maybeSingle();
    if (!et) throw new Error("Event type not found or inactive");

    const startMs = new Date(data.startISO).getTime();
    const endMs = startMs + et.duration_min * 60_000;
    const startISO = new Date(startMs).toISOString();
    const endISO = new Date(endMs).toISOString();
    const emailLower = data.email.toLowerCase();

    const { data: existing } = await db
      .from("bookings")
      .select("id, google_event_id, booking_attendees(id, email, full_name)")
      .eq("event_type_id", et.id)
      .eq("start_at", startISO)
      .maybeSingle();

    const google = await import("./google-calendar.server");

    if (existing) {
      const attendees = existing.booking_attendees ?? [];
      if (attendees.some((a) => a.email.toLowerCase() === emailLower))
        throw new Error("You're already registered for this slot");
      if (attendees.length >= et.capacity) throw new Error("This slot is full");

      const { error: attErr } = await db.from("booking_attendees").insert({
        booking_id: existing.id,
        email: data.email,
        full_name: data.name,
        notes: data.notes,
      });
      if (attErr) throw new Error(attErr.message);

      if (existing.google_event_id) {
        const newList = [
          ...attendees.map((a) => ({
            email: a.email,
            displayName: a.full_name ?? undefined,
          })),
          { email: data.email, displayName: data.name },
        ];
        await google.patchAttendees(existing.google_event_id, newList);
      }
      return { bookingId: existing.id };
    }

    const gEventId = await google.createCalendarEvent({
      summary: et.title,
      description: et.description ?? undefined,
      startISO,
      endISO,
      attendees: [{ email: data.email, displayName: data.name }],
    });

    const { data: booking, error: bErr } = await db
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

    const { error: attErr } = await db.from("booking_attendees").insert({
      booking_id: booking.id,
      email: data.email,
      full_name: data.name,
      notes: data.notes,
    });
    if (attErr) throw new Error(attErr.message);

    return { bookingId: booking.id };
  });