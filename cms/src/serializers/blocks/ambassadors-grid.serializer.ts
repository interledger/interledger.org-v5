import jsesc from 'jsesc'
import type { AmbassadorBase } from '../../api/ambassador/types'

const escDouble = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')
const escSingle = (v: string) => (v ? jsesc(v, { quotes: 'single' }) : '')

export function serialize(block: {
  heading?: string
  ambassadors?: AmbassadorBase[]
  category?: string
}): string {
  const pathSlugs = (block.ambassadors || [])
    .filter((amb) => amb?.pathSlug)
    .map((amb) => `'${escSingle(amb.pathSlug)}'`)

  const pathSlugsAttr =
    pathSlugs.length > 0 ? ` pathSlugs={[${pathSlugs.join(',')}]}` : ''

  const headingAttr = block.heading
    ? ` heading="${escDouble(block.heading)}"`
    : ''
  const categoryAttr = block.category
    ? ` category="${escDouble(block.category)}"`
    : ''

  return `<AmbassadorGrid${headingAttr}${pathSlugsAttr}${categoryAttr} />`
}
