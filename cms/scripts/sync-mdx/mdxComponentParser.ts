/**
 * Parses MDX body content into structured blocks for Strapi sync.
 * Supports: <Paragraph>, <AmbassadorGrid>, <Blockquote>, and plain text.
 */

export type ParsedBlock =
  | { type: 'paragraph'; content: string }
  | { type: 'ambassadors-grid'; heading?: string; slugs: string[] }
  | { type: 'blockquote'; quote: string; source?: string }

/**
 * Extract string attribute from JSX: heading="value" or heading='value'
 */
function extractStringAttr(attrs: string, name: string): string | undefined {
  const regex = new RegExp(`${name}=["']([^"']*)["']`, 'i')
  const m = attrs.match(regex)
  return m ? m[1] : undefined
}

/**
 * Extract slugs array from JSX: slugs={["a","b"]} or slugs={['a','b']}
 */
function extractSlugsAttr(attrs: string): string[] {
  const m = attrs.match(/slugs=\{\s*\[(.*?)\]\s*\}/s)
  if (!m) return []
  const inner = m[1]
  const slugs: string[] = []
  const matches = inner.matchAll(/"([^"]*)"|'([^']*)'/g)
  for (const match of matches) {
    slugs.push(match[1] ?? match[2] ?? '')
  }
  return slugs.filter(Boolean)
}

/**
 * Parse MDX content into blocks.
 * - <Paragraph>...</Paragraph> or plain text → paragraph block
 * - <AmbassadorGrid heading="..." slugs={[...]} /> → ambassadors-grid block
 * - <Blockquote source="...">...</Blockquote> → blockquote block
 */
export function parseMdxComponents(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const trimmed = (content || '').trim()
  if (!trimmed) return blocks

  // Split by component boundaries while preserving order
  // Pattern: <ComponentName> or <ComponentName ...> or <ComponentName ... />
  const componentRegex =
    /<(Paragraph|AmbassadorGrid|Blockquote)(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/\1>)/gi

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = componentRegex.exec(trimmed)) !== null) {
    const [fullMatch, componentName, attrs, childContent] = match
    const before = trimmed.slice(lastIndex, match.index).trim()

    // Plain text before this component → paragraph
    if (before.length > 0) {
      blocks.push({ type: 'paragraph', content: before })
    }

    const name = componentName.toLowerCase()

    if (name === 'paragraph') {
      blocks.push({ type: 'paragraph', content: (childContent || '').trim() })
    } else if (name === 'ambassadorgrid') {
      const heading = extractStringAttr(attrs, 'heading')
      const slugs = extractSlugsAttr(attrs)
      blocks.push({ type: 'ambassadors-grid', heading, slugs })
    } else if (name === 'blockquote') {
      const source = extractStringAttr(attrs, 'source')
      const quote = (childContent || '').trim().replace(/^["']|["']$/g, '')
      blocks.push({ type: 'blockquote', quote, source })
    }

    lastIndex = match.index + fullMatch.length
  }

  // Remaining content after last component
  const after = trimmed.slice(lastIndex).trim()
  if (after.length > 0) {
    blocks.push({ type: 'paragraph', content: after })
  }

  // If no components matched, treat entire content as one paragraph
  if (blocks.length === 0 && trimmed.length > 0) {
    blocks.push({ type: 'paragraph', content: trimmed })
  }

  return blocks
}
