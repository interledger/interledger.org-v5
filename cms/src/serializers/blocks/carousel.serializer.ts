import jsesc from 'jsesc'
import { getImageUrl } from '../../utils/mdx'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

export function serialize(block: {
  heading?: string
  items?: Array<{
    title: string
    description?: string
    image?: { url?: string }
    link?: string
  }>
}): string {
  const lines: string[] = []

  if (block.heading) {
    lines.push(`## ${block.heading}`)
    lines.push('')
  }

  lines.push('<Carousel>')

  if (block.items) {
    for (const item of block.items) {
      const imageUrl = getImageUrl(item.image)
      lines.push('')
      lines.push(
        `<CarouselItem title="${esc(item.title)}"${imageUrl ? ` image="${esc(imageUrl)}"` : ''}${item.link ? ` link="${esc(item.link)}"` : ''}>`
      )
      if (item.description) {
        lines.push(item.description)
      }
      lines.push('</CarouselItem>')
    }
  }

  lines.push('')
  lines.push('</Carousel>')
  return lines.join('\n')
}
