export function truncateText(text: string, maxLength: number = 400): string {
  if (text.length <= maxLength) return text

  const truncated = text.slice(0, maxLength)

  // Cut back to last full word
  const lastSpace = truncated.lastIndexOf(' ')
  const cleanText = truncated.slice(0, lastSpace)

  return cleanText + ' …'
}
