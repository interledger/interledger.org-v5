import { getImageUrl } from '@/utils/mdx'

export function serialize(block: {
  images?: Array<{ url?: string; alternativeText?: string }>
}): string {
  const lines: string[] = []
  lines.push('<ImageRow>')

  if (block.images) {
    for (const image of block.images) {
      const url = getImageUrl(image)
      if (url) {
        lines.push(`  ![${image.alternativeText || ''}](${url})`)
      }
    }
  }

  lines.push('</ImageRow>')
  return lines.join('\n')
}
