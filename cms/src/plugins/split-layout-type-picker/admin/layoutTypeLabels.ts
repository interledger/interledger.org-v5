export type LayoutType =
  | 'image-text'
  | 'image-quote'
  | 'video-text'
  | 'video-quote'

export const LAYOUT_TYPE_LABELS: Record<LayoutType, string> = {
  'image-text': 'Image + Text',
  'image-quote': 'Image + Quote',
  'video-text': 'Video + Text',
  'video-quote': 'Video + Quote'
}

const LAYOUT_TYPE_SLUGS = new Set<string>(Object.keys(LAYOUT_TYPE_LABELS))

export function isLayoutTypeSlug(value: string): value is LayoutType {
  return LAYOUT_TYPE_SLUGS.has(value)
}

export function getLayoutTypeLabel(value: string | null | undefined): string {
  if (!value) return ''
  return isLayoutTypeSlug(value) ? LAYOUT_TYPE_LABELS[value] : value
}

const SPLIT_LAYOUT_TITLE_SUFFIX =
  /^(.+?)(\s*[-–—]\s*)(image-text|image-quote|video-text|video-quote)$/

/** Rewrites panel titles like "Split Layout - image-quote" to human labels. */
export function formatSplitLayoutPanelTitle(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  if (isLayoutTypeSlug(trimmed)) {
    return getLayoutTypeLabel(trimmed)
  }

  const match = trimmed.match(SPLIT_LAYOUT_TITLE_SUFFIX)
  if (!match) return null

  const [, prefix, separator, slug] = match
  if (!isLayoutTypeSlug(slug)) return null

  return `${prefix}${separator}${LAYOUT_TYPE_LABELS[slug]}`
}
