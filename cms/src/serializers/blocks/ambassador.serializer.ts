import jsesc from 'jsesc'
import { getImageUrl } from '../../utils/mdx'
import type { AmbassadorBase } from '../../api/ambassador/types'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

export function serialize(block: {
  ambassador?: AmbassadorBase | null
}): string {
  if (!block.ambassador) return ''

  const amb = block.ambassador
  const photo = amb.photo ? (getImageUrl(amb.photo) ?? '') : ''

  return `<AmbassadorCard
  name="${esc(amb.name)}"
  slug="${esc(amb.slug)}"
  description="${esc(amb.description || '')}"
  photo="${esc(photo)}"
  photoAlt="${esc(amb.photoAlt || '')}"
  linkedinUrl="${esc(amb.linkedinUrl || '')}"
  grantReportUrl="${esc(amb.grantReportUrl || '')}"
/>`
}
