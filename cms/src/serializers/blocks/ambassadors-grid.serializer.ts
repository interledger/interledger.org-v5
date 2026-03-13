import jsesc from 'jsesc'
import type { AmbassadorBase } from '../../api/ambassador/types'

const escDouble = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')
const escSingle = (v: string) => (v ? jsesc(v, { quotes: 'single' }) : '')

export function serialize(block: {
  heading?: string
  ambassadors?: AmbassadorBase[]
}): string {
  const pathSlugs = (block.ambassadors || [])
    .filter((amb) => amb?.pathSlug)
    .map((amb) => `'${escSingle(amb.pathSlug)}'`)

  if (pathSlugs.length === 0) return ''

  const headingAttr = block.heading
    ? ` heading="${escDouble(block.heading)}"`
    : ''
  return `<AmbassadorGrid${headingAttr} pathSlugs={[${pathSlugs.join(',')}]} />`
}
