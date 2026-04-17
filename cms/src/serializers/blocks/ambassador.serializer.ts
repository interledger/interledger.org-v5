import { getImageUrl } from '../../utils'
import type { AmbassadorBase } from '../../api/ambassador/types'

const escAttr = (v: string) => v.replace(/"/g, '&quot;')

export function serialize(block: {
  ambassador?: AmbassadorBase | null
}): string {
  if (!block.ambassador) return ''

  const amb = block.ambassador
  const photo = amb.photo ? (getImageUrl(amb.photo) ?? '') : ''

  return `<Ambassador
  name="${escAttr(amb.name)}"
  pathSlug="${escAttr(amb.pathSlug)}"
  photo="${escAttr(photo)}"
  ${amb.photo?.alternativeText !== undefined && amb.photo?.alternativeText !== null ? `photoAlt="${escAttr(amb.photo.alternativeText)}"` : ''}
  quote="${escAttr(amb.quote || '')}"
/>`
}
