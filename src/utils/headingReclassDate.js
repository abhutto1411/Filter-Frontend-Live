/**
 * Default entry date for Super Admin heading reclass.
 * Prefer startDate − 1 day when that day is not locked; else today (Riyadh YMD).
 */
export function defaultHeadingReclassDate({
  startDate,
  lockedUpTo,
  todayYmd,
}) {
  const today = String(todayYmd || '').slice(0, 10);
  const start = String(startDate || '').trim().slice(0, 10);
  const lock = lockedUpTo == null || lockedUpTo === ''
    ? null
    : String(lockedUpTo).trim().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    const d = new Date(`${start}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const candidate = d.toISOString().slice(0, 10);
    if (!lock || candidate > lock) return candidate;
  }
  return today;
}
