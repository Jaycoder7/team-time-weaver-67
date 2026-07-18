// Per-user Google Calendar helpers via the App User Connector gateway.
// Every function takes a per-user connectionAPIKey. When null/undefined the
// call is a no-op — that user simply hasn't connected their calendar yet.

import { formatGoogleDateTime, safeTimeZone } from "./timezone.server";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";
const CAL_PATH = "/calendar/v3";

async function call(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: `${CAL_PATH}${path}`,
    init,
  });
}

export async function getPrimaryCalendarTimeZone(
  connectionAPIKey: string | null | undefined,
): Promise<string | null> {
  if (!connectionAPIKey) return null;
  const res = await call(connectionAPIKey, "/calendars/primary");
  if (!res.ok) {
    console.error("google calendar timezone lookup failed", res.status, await res.text());
    return null;
  }
  const body = (await res.json()) as { timeZone?: string };
  return safeTimeZone(body.timeZone) ?? null;
}

export async function getBusyIntervals(
  connectionAPIKey: string | null | undefined,
  timeMin: string,
  timeMax: string,
): Promise<Array<{ start: string; end: string }>> {
  if (!connectionAPIKey) return [];
  const res = await call(connectionAPIKey, "/freeBusy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
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

export async function createCalendarEvent(
  connectionAPIKey: string | null | undefined,
  input: {
    summary: string;
    description?: string;
    startISO: string;
    endISO: string;
    timeZone?: string;
    attendees: GoogleAttendee[];
  },
): Promise<string | null> {
  if (!connectionAPIKey) return null;
  const timeZone = safeTimeZone(input.timeZone) ?? undefined;
  const res = await call(connectionAPIKey, "/calendars/primary/events?sendUpdates=all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  connectionAPIKey: string | null | undefined,
  eventId: string,
  attendees: GoogleAttendee[],
): Promise<void> {
  if (!connectionAPIKey) return;
  const res = await call(
    connectionAPIKey,
    `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendees }),
    },
  );
  if (!res.ok) console.error("google event patch failed", res.status, await res.text());
}

export async function deleteCalendarEvent(
  connectionAPIKey: string | null | undefined,
  eventId: string,
): Promise<void> {
  if (!connectionAPIKey) return;
  const res = await call(
    connectionAPIKey,
    `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    console.error("google event delete failed", res.status, await res.text());
  }
}