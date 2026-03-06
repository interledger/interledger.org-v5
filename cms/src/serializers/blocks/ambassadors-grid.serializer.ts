import jsesc from 'jsesc'
import type { AmbassadorBase } from '../../api/ambassador/types'

const escDouble = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')
const escSingle = (v: string) => (v ? jsesc(v, { quotes: 'single' }) : '')

export function serialize(block: {
  heading?: string
  ambassadors?: AmbassadorBase[]
}): string {
  const slugs = (block.ambassadors || [])
    .filter((amb) => amb?.slug)
    .map((amb) => `'${escSingle(amb.slug)}'`)

  if (slugs.length === 0) return ''

  const headingAttr = block.heading ? ` heading="${escDouble(block.heading)}"` : ''
  return `<AmbassadorGrid${headingAttr} slugs={[${slugs.join(',')}]} />`
}
