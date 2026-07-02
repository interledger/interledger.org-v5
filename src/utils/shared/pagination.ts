export const MAX_PAGINATION_THRESHOLD = 6

export function getVisiblePages(
  current: number,
  total: number
): (number | '...')[] {
  const radius = 1
  if (total < MAX_PAGINATION_THRESHOLD)
    return Array.from({ length: total }, (_, i) => i + 1)

  const windowStart = Math.max(1, current - radius)
  const windowEnd = Math.min(total, current + radius)
  const minEdgePages = radius + 3
  const pages: (number | '...')[] = []

  if (windowStart <= 2) {
    // Near start: show a minimum block anchored to page 1
    const blockEnd = Math.max(windowEnd, minEdgePages)
    for (let i = 1; i <= blockEnd; i++) pages.push(i)
    if (blockEnd < total - 1) pages.push('...')
    if (blockEnd < total) pages.push(total)
  } else if (windowEnd >= total - 1) {
    // Near end: show a minimum block anchored to last page
    const blockStart = Math.min(windowStart, total - minEdgePages + 1)
    pages.push(1)
    if (blockStart > 2) pages.push('...')
    for (let i = Math.max(2, blockStart); i <= total; i++) pages.push(i)
  } else {
    // Middle: standard window, ellipses always needed on both sides
    pages.push(1)
    pages.push('...')
    for (let i = windowStart; i <= windowEnd; i++) pages.push(i)
    pages.push('...')
    pages.push(total)
  }

  return pages
}
