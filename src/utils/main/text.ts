const ELLIPSIS = ' …'

export function truncateText(text: string, maxLength: number = 400): string {
  if (text.length <= maxLength) return text
  if (maxLength <= ELLIPSIS.length) return text.slice(0, maxLength)

  const truncated = text.slice(0, maxLength - ELLIPSIS.length)
  const lastSpace = truncated.lastIndexOf(' ')
  const cleanText = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated
  return cleanText + ELLIPSIS
}
