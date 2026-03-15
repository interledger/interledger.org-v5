import jsesc from 'jsesc'
import { getImageUrl } from '../../utils/mdx'
import type { AmbassadorBase } from '../../api/ambassador/types'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

export function serialize(block: {
  ambassador?: AmbassadorBase | null
  showLinks?: boolean
}): string {
  if (!block.ambassador) return ''

  const amb = block.ambassador
  const photo = amb.photo ? (getImageUrl(amb.photo) ?? '') : ''
  const showLinksAttr = block.showLinks === false ? '\n  showLinks={false}' : ''

  return `<Ambassador
  name="${esc(amb.name)}"
  pathSlug="${esc(amb.pathSlug)}"
  description="${esc(amb.description || '')}"
  photo="${esc(photo)}"
  photoAlt="${esc(amb.photo?.alternativeText || '')}"
  linkedinUrl="${esc(amb.linkedinUrl || '')}"
  grantReportUrl="${esc(amb.grantReportUrl || '')}"${showLinksAttr}
/>`
}
