import { getImageUrl } from '../../utils'
import type { ProfilePageBase } from '../../api/profile-page/types'

const escAttr = (v: string) => v.replace(/"/g, '&quot;')

export function serialize(block: { profile?: ProfilePageBase | null }): string {
  if (!block.profile) return ''

  const profile = block.profile
  const photoUrl = profile.media?.image
    ? getImageUrl(profile.media.image)
    : undefined

  return `<ProfileCard
  name="${escAttr(profile.name)}"
  pathSlug="${escAttr(profile.pathSlug)}"
  ${photoUrl ? `photo="${escAttr(photoUrl)}"` : ''}
  ${
    profile.media?.alternativeText !== undefined &&
    profile.media?.alternativeText !== null
      ? `photoAlt="${escAttr(profile.media.alternativeText)}"`
      : ''
  }
  tagline="${escAttr(profile.tagline || '')}"
/>`
}
