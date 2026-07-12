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
