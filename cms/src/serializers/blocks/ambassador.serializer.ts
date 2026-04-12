import { getImageUrl } from '../../utils'
import type { AmbassadorBase } from '../../api/ambassador/types'

const escAttr = (v: string) => v.replace(/"/g, '&quot;')

export function serialize(block: {
  ambassador?: AmbassadorBase | null
  showLinks?: boolean
}): string {
  if (!block.ambassador) return ''

  const amb = block.ambassador
  const photo = amb.photo ? (getImageUrl(amb.photo) ?? '') : ''
  const showLinksAttr = block.showLinks === false ? '\n  showLinks={false}' : ''

  return `<Ambassador
  name="${escAttr(amb.name)}"
  pathSlug="${escAttr(amb.pathSlug)}"
  photo="${escAttr(photo)}"
  photoAlt="${escAttr(amb.photo?.alternativeText || '')}"
  quote="${escAttr(amb.quote || '')}"${showLinksAttr}
/>`
}
