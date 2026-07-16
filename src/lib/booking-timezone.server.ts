import { getPrimaryCalendarTimeZone } from "./google-calendar.server";
import { safeTimeZone } from "./timezone.server";

export async function getBookingTimeZone(
  ownerId: string,
  readProfileTimeZone: (ownerId: string) => Promise<string | null | undefined>,
): Promise<string> {
  const calendarTimeZone = await getPrimaryCalendarTimeZone();
  if (calendarTimeZone) return calendarTimeZone;

  return safeTimeZone(await readProfileTimeZone(ownerId)) ?? "UTC";
}