// Google Calendar helpers via Lovable connector gateway.
// Safe to call when GOOGLE_CALENDAR_API_KEY is unset — returns null/no-op.

import { formatGoogleDateTime, safeTimeZone } from "./timezone.server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export function isGoogleCalendarConnected(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.GOOGLE_CALENDAR_API_KEY);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": process.env.GOOGLE_CALENDAR_API_KEY!,
    "Content-Type": "application/json",
  };
}

export async function getPrimaryCalendarTimeZone(): Promise<string | null> {
  if (!isGoogleCalendarConnected()) return null;
  const res = await fetch(`${GATEWAY}/calendars/primary`, {
    method: "GET",
    headers: headers(),
  });
  if (!res.ok) {
    console.error("google calendar timezone lookup failed", res.status, await res.text());
    return null;
  }
  const body = (await res.json()) as { timeZone?: string };
  return safeTimeZone(body.timeZone) ?? null;
}

/** Returns array of {start,end} busy intervals from the primary calendar for the range. */
export async function getBusyIntervals(
  timeMin: string,
  timeMax: string,
): Promise<Array<{ start: string; end: string }>> {
  if (!isGoogleCalendarConnected()) return [];
  const res = await fetch(`${GATEWAY}/freeBusy`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  });
  if (!res.ok) {
    console.error("google freeBusy failed", res.status, await res.text());
    return [];
  }
  const body = (await res.json()) as {
    calendars?: { primary?: { busy?: Array<{ start: string; end: string }> } };
  };
  return body.calendars?.primary?.busy ?? [];
}

export interface GoogleAttendee {
  email: string;
  displayName?: string;
}

export async function createCalendarEvent(input: {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  timeZone?: string;
  attendees: GoogleAttendee[];
}): Promise<string | null> {
  if (!isGoogleCalendarConnected()) return null;
  const timeZone = safeTimeZone(input.timeZone) ?? undefined;
  const res = await fetch(`${GATEWAY}/calendars/primary/events?sendUpdates=all`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: timeZone
        ? { dateTime: formatGoogleDateTime(input.startISO, timeZone), timeZone }
        : { dateTime: input.startISO },
      end: timeZone
        ? { dateTime: formatGoogleDateTime(input.endISO, timeZone), timeZone }
        : { dateTime: input.endISO },
      attendees: input.attendees,
    }),
  });
  if (!res.ok) {
    console.error("google event create failed", res.status, await res.text());
    return null;
  }
  const body = (await res.json()) as { id?: string };
  return body.id ?? null;
}

export async function patchAttendees(
  eventId: string,
  attendees: GoogleAttendee[],
): Promise<void> {
  if (!isGoogleCalendarConnected()) return;
  const res = await fetch(
    `${GATEWAY}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ attendees }),
    },
  );
  if (!res.ok) console.error("google event patch failed", res.status, await res.text());
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!isGoogleCalendarConnected()) return;
  const res = await fetch(
    `${GATEWAY}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE", headers: headers() },
  );
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    console.error("google event delete failed", res.status, await res.text());
  }
}