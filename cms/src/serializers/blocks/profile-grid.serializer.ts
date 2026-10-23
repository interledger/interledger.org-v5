import type { ProfilePageBase } from '../../api/profile-page/types'
import {
  introWithLegacyHeading,
  serializeIntroProp,
  type BlockIntroInput
} from '../../utils'
import { escDouble, escSingle } from '../shared'

export function serialize(block: {
  intro?: BlockIntroInput | null
  /** @deprecated Legacy heading; exported as `intro.heading` until removed. */
  heading?: string
  profiles?: ProfilePageBase[]
  category?: string
}): string {
  const profiles = Array.isArray(block.profiles) ? block.profiles : []
  const pathSlugs = profiles
    .filter((profile) => profile?.pathSlug)
    .map((profile) => `'${escSingle(profile.pathSlug)}'`)

  const introAttr = serializeIntroProp(
    introWithLegacyHeading(block.intro, block.heading)
  )
  const pathSlugsAttr =
    pathSlugs.length > 0 ? ` pathSlugs={[${pathSlugs.join(',')}]}` : ''
  const categoryAttr =
    block.category && pathSlugs.length === 0
      ? ` category="${escDouble(block.category)}"`
      : ''
  return `<ProfileGrid${introAttr}${pathSlugsAttr}${categoryAttr} />`
}
