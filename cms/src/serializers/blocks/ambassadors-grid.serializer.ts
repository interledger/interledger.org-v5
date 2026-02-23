import jsesc from 'jsesc'
import type { AmbassadorBase } from '@/api/ambassador/types'

const esc = (v: string) => (v ? jsesc(v, { quotes: 'double' }) : '')

export function serialize(block: {
  heading?: string
  ambassadors?: AmbassadorBase[]
}): string {
  const slugs = (block.ambassadors || [])
    .filter((amb) => amb?.slug)
    .map((amb) => `"${esc(amb.slug)}"`)

  if (slugs.length === 0) return ''

  const headingAttr = block.heading ? ` heading="${esc(block.heading)}"` : ''
  return `<AmbassadorGrid${headingAttr} slugs={[${slugs.join(',')}]} />`
}
