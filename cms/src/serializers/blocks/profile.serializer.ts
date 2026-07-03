import { getImageUrl } from '../../utils'
import type { ProfilePageBase } from '../../api/profile-page/types'

const escAttr = (v: string) => v.replace(/"/g, '&quot;')

export function serialize(block: { profile?: ProfilePageBase | null }): string {
  if (!block.profile) return ''

  const profile = block.profile
  const photoUrl = profile.photo ? getImageUrl(profile.photo) : undefined

  return `<ProfileCard
  name="${escAttr(profile.name)}"
  pathSlug="${escAttr(profile.pathSlug)}"
  ${photoUrl ? `photo="${escAttr(photoUrl)}"` : ''}
  ${profile.photo?.alternativeText !== undefined && profile.photo?.alternativeText !== null ? `photoAlt="${escAttr(profile.photo.alternativeText)}"` : ''}
  tagline="${escAttr(profile.tagline || '')}"
/>`
}
