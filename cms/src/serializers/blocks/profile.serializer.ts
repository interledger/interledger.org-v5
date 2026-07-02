import { getImageUrl } from '../../utils'
import type { ProfilePageBase } from '../../api/profile-page/types'

const escAttr = (v: string) => v.replace(/"/g, '&quot;')

export function serialize(block: { profile?: ProfilePageBase | null }): string {
  if (!block.profile) return ''

  const profile = block.profile
  const photo = profile.photo ? (getImageUrl(profile.photo) ?? '') : ''

  return `<ProfileCard
  name="${escAttr(profile.name)}"
  pathSlug="${escAttr(profile.pathSlug)}"
  photo="${escAttr(photo)}"
  ${profile.photo?.alternativeText !== undefined && profile.photo?.alternativeText !== null ? `photoAlt="${escAttr(profile.photo.alternativeText)}"` : ''}
  tagline="${escAttr(profile.tagline || '')}"
/>`
}
