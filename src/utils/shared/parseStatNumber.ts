/** Parses a stat tile's free-text number field (e.g. "1,000") into a plain
 * number for driving a count-up animation. Returns null when the text isn't
 * a parseable number (e.g. it's non-numeric), so callers can fall back to a
 * static, non-animated render instead. */
export function parseStatNumber(text: string): number | null {
  const stripped = text.replace(/,/g, '')
  const n = Number(stripped)
  return Number.isFinite(n) && stripped.trim() !== '' ? n : null
}
