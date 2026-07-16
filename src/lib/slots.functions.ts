import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Slot {
  startISO: string;
  endISO: string;
  bookingId: string | null;
  attendeeCount: number;
  full: boolean;
  joined: boolean;
}

const inputSchema = z.object({
  eventTypeId: z.string().uuid(),
  dateISO: z.string(), // YYYY-MM-DD in owner timezone
});

export const getSlotsForDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<Slot[]> => {
    const { supabase, userId } = context;
    const { data: et, error: etErr } = await supabase
      .from("event_types")
      .select("*")
      .eq("id", data.eventTypeId)
      .maybeSingle();
    if (etErr || !et) return [];

    const { data: rules } = await supabase.from("availability_rules").select("*");
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", et.owner_id)
      .maybeSingle();
    const tz = profile?.timezone ?? "UTC";

    const { zonedWallTimeToUtc, weekdayInZone } = await import("./timezone.server");
    const [y, m, d] = data.dateISO.split("-").map(Number);
    const weekday = weekdayInZone(data.dateISO, tz);
    const dayRules = (rules ?? []).filter((r) => r.weekday === weekday);
    if (dayRules.length === 0) return [];

    const dayStart = zonedWallTimeToUtc(y, m, d, 0, 0, tz);
    const dayEnd = zonedWallTimeToUtc(y, m, d + 1, 0, 0, tz);
    const now = new Date();
    const minStart = new Date(now.getTime() + et.min_notice_hours * 3600_000);
    const maxStart = new Date(now.getTime() + et.max_days_ahead * 86400_000);

    // Existing bookings for this event type on this day
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("id, start_at, end_at, booking_attendees(user_id)")
      .eq("event_type_id", et.id)
      .gte("start_at", dayStart.toISOString())
      .lt("start_at", dayEnd.toISOString());

    // Google Calendar busy intervals — exclude intervals for our own bookings so
    // group slots stay bookable after the first attendee joins.
    const ownBookingStarts = new Set(
      (existingBookings ?? []).map((b) => new Date(b.start_at).getTime()),
    );
    const { getBusyIntervals } = await import("./google-calendar.server");
    const rawBusy = await getBusyIntervals(dayStart.toISOString(), dayEnd.toISOString());
    const busy = rawBusy.filter(
      (b) => !ownBookingStarts.has(new Date(b.start).getTime()),
    );

    const slots: Slot[] = [];
    const durMs = et.duration_min * 60_000;
    const bufBeforeMs = et.buffer_before_min * 60_000;
    const bufAfterMs = et.buffer_after_min * 60_000;

    for (const rule of dayRules) {
      const [sh, sm] = rule.start_time.split(":").map(Number);
      const [eh, em] = rule.end_time.split(":").map(Number);
      const winStart = zonedWallTimeToUtc(y, m, d, sh, sm, tz);
      const winEnd = zonedWallTimeToUtc(y, m, d, eh, em, tz);

      for (let t = winStart.getTime(); t + durMs <= winEnd.getTime(); t += durMs) {
        const s = new Date(t);
        const e = new Date(t + durMs);
        if (s < minStart || s > maxStart) continue;

        // Check google busy (with buffer)
        const sBuf = t - bufBeforeMs;
        const eBuf = t + durMs + bufAfterMs;
        const googleConflict = busy.some((b) => {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return bs < eBuf && be > sBuf;
        });
        if (googleConflict) continue;

        // Check existing bookings at same start (group slot reuse)
        const existing = (existingBookings ?? []).find(
          (b) => new Date(b.start_at).getTime() === t,
        );
        const attendees = existing?.booking_attendees ?? [];
        const attendeeCount = attendees.length;
        const joined = attendees.some((a: { user_id: string | null }) => a.user_id === userId);
        const full = attendeeCount >= et.capacity;

        // Also block if any other booking (different start) overlaps this slot when capacity == 1
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
          endISO: e.toISOString(),
          bookingId: existing?.id ?? null,
          attendeeCount,
          full,
          joined,
        });
      }
    }
    return slots;
  });