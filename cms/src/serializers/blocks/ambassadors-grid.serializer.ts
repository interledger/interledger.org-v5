import type { AmbassadorBase } from '../../api/ambassador/types'
import { escDouble, escSingle } from '../shared'

export function serialize(block: {
  heading?: string
  ambassadors?: AmbassadorBase[]
  category?: string
}): string {
  const pathSlugs = (block.ambassadors || [])
    .filter((amb) => amb?.pathSlug)
    .map((amb) => `'${escSingle(amb.pathSlug)}'`)

  const headingAttr = block.heading
    ? ` heading="${escDouble(block.heading)}"`
    : ''
  const pathSlugsAttr =
    pathSlugs.length > 0 ? ` pathSlugs={[${pathSlugs.join(',')}]}` : ''
  const categoryAttr = block.category
    ? ` category="${escDouble(block.category)}"`
    : ''
  return `<AmbassadorGrid${headingAttr}${pathSlugsAttr}${categoryAttr} />`
}
