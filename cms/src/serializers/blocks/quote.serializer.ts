import {
  getImageUrl,
  hasMediaValue,
  ckeditorFieldToCompiledMarkdown
} from '../../utils'
import { escDouble as esc, escMdxBraces } from '../shared'

type ImageField = { url?: string; alternativeText?: string } | number

export function serialize(block: {
  quote?: string
  authorName?: string
  authorImage?: ImageField
  authorLink?: string
}): string {
  if (!block.quote?.trim()) {
    throw new Error('Quote block is missing quote text')
  }

  // Escape { and } so MDX doesn't try to parse them as JS expressions.
  // CKEditor may hand back HTML; convert defensively like other text blocks.
  const quote = escMdxBraces(ckeditorFieldToCompiledMarkdown(block.quote))

  const attrs: string[] = []
  if (block.authorName?.trim()) {
    attrs.push(`authorName="${esc(block.authorName.trim())}"`)
  }

  if (hasMediaValue(block.authorImage)) {
    const image =
      typeof block.authorImage === 'object' ? block.authorImage : undefined
    const src = getImageUrl(image)
    if (src) attrs.push(`authorImage="${esc(src)}"`)
  }

  if (block.authorLink?.trim()) {
    attrs.push(`authorLink="${esc(block.authorLink.trim())}"`)
  }

  const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : ''

  return `<Quote${attrStr}>\n  ${quote}\n</Quote>`
}
