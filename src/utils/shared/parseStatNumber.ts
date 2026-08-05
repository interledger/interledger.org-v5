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

/**
 * Expands free-text number-tile suffixes that screen readers mangle
 * (e.g. "M+" → "million plus"). Unknown suffixes pass through unchanged.
 */
function expandStatSuffix(suffix: string): string {
  const expansions: Record<string, string> = {
    'M+': 'million plus',
    M: 'million',
    'K+': 'thousand plus',
    K: 'thousand',
    'B+': 'billion plus',
    B: 'billion',
    '+': 'plus'
  }
  return expansions[suffix] ?? suffix
}

/**
 * Builds a screen-reader label for a freeform NumberTiles entry.
 *
 * Returns `undefined` when there is no prefix/suffix so StatCard can fall back
 * to reading the visible number + description. When affixes are present (e.g.
 * "$" + "M+"), expands common forms so engines don't say "M plus" or skip "$".
 *
 * Reading order mirrors the homepage stats pattern:
 * `21 million plus dollars In Grants` for `$` + `21` + `M+` + `In Grants`.
 */
export function buildNumberTileAriaLabel(
  display: string,
  description: string,
  prefix?: string,
  suffix?: string
): string | undefined {
  if (!prefix && !suffix) return undefined

  const parts: string[] = []
  if (prefix && prefix !== '$') {
    parts.push(prefix)
  }
  parts.push(display)
  if (suffix) {
    parts.push(expandStatSuffix(suffix))
  }
  if (prefix === '$') {
    parts.push('dollars')
  }
  parts.push(description)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
