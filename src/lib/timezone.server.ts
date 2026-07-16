// Timezone helpers used server-side to build slots in the owner's timezone.

export function safeTimeZone(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return null;
  }
}

function partsInZone(date: Date, tz: string): Record<string, string> {
  const safeTz = safeTimeZone(tz) ?? "UTC";
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value])) as Record<
    string,
    string
  >;
}

/**
 * Given wall-clock parts (Y-M-D H:m) interpreted in `tz`, return the exact UTC instant.
 * Works for any IANA timezone via Intl.DateTimeFormat.
 */
export function zonedWallTimeToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  tz: string,
): Date {
  const safeTz = safeTimeZone(tz) ?? "UTC";
  // Start with the naive UTC instant, then compute the offset the zone had at that instant.
  const asUTC = Date.UTC(y, m - 1, d, h, min);
  const parts = partsInZone(new Date(asUTC), safeTz);
  const asZoned = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asZoned - asUTC;
  return new Date(asUTC - offset);
}

/** Weekday (0=Sun..6=Sat) for a YYYY-MM-DD calendar date. */
export function weekdayFromDateISO(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** Backwards-compatible alias for existing callers. */
export function weekdayInZone(dateISO: string): number {
  return weekdayFromDateISO(dateISO);
}

/** Google Calendar prefers local dateTime plus an explicit IANA timeZone. */
export function formatGoogleDateTime(iso: string, tz: string): string {
  const parts = partsInZone(new Date(iso), tz);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}