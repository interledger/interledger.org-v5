import type { ProfilePageBase } from '../../api/profile-page/types'
import { escDouble, escSingle } from '../shared'

export function serialize(block: {
  heading?: string
  profiles?: ProfilePageBase[]
  category?: string
}): string {
  const pathSlugs = (block.profiles || [])
    .filter((profile) => profile?.pathSlug)
    .map((profile) => `'${escSingle(profile.pathSlug)}'`)

  const headingAttr = block.heading
    ? ` heading="${escDouble(block.heading)}"`
    : ''
  const pathSlugsAttr =
    pathSlugs.length > 0 ? ` pathSlugs={[${pathSlugs.join(',')}]}` : ''
  const categoryAttr =
    block.category && pathSlugs.length === 0
      ? ` category="${escDouble(block.category)}"`
      : ''
  return `<ProfileGrid${headingAttr}${pathSlugsAttr}${categoryAttr} />`
}
