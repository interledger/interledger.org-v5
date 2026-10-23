const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Whether `value` is a real `YYYY-MM-DD` day, the shape Strapi stores a
 * `date` field in. Rejects impossible days such as `2026-02-30`, which
 * `Date` would silently roll over into March.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = CALENDAR_DATE.exec(value)
  if (!match) return false

  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  )
}
