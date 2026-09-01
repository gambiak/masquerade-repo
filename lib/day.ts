const MASQUERADE_TIME_ZONE = "America/Chicago";

export function todayGameDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MASQUERADE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}
