/** Parses a stat tile's free-text number field (e.g. "1,000" or "1000") into a
 * plain number for driving a count-up animation. Returns null when the text
 * isn't a parseable number (e.g. it's non-numeric), so callers can fall back
 * to a static, non-animated render instead. */
export function parseStatNumber(text: string): number | null {
  const stripped = text.replace(/,/g, '')
  const n = Number(stripped)
  return Number.isFinite(n) && stripped.trim() !== '' ? n : null
}

/** Formats a number with grouping commas for display (e.g. 1000 → "1,000").
 * Uses en-US so Strapi editors can enter plain digits and the site always
 * shows a consistent thousands separator. */
export function formatStatNumber(value: number): string {
  return value.toLocaleString('en-US')
}
