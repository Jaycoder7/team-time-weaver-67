// Timezone helpers used server-side to build slots in the owner's timezone.

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
  // Start with the naive UTC instant, then compute the offset the zone had at that instant.
  const asUTC = Date.UTC(y, m - 1, d, h, min);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(asUTC)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const hh = parts.hour === "24" ? 0 : Number(parts.hour);
  const asZoned = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hh,
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asZoned - asUTC;
  return new Date(asUTC - offset);
}

/** Weekday (0=Sun..6=Sat) for a YYYY-MM-DD date interpreted in `tz`. */
export function weekdayInZone(dateISO: string, tz: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  // Use noon UTC as anchor — safe from DST transitions when reading the weekday in tz.
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(anchor);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}