// Temporary probe for INTORG-1423. Do not merge. Runs the parser of the
// ravi/intorg-1423 branch on the real Submitted Reports rows. The run log is
// public, so it prints counts only: no links, hosts or record values.
import {
  legacyReportFieldIdsToFetch,
  toLegacyGrantReports
} from './src/utils/main/airtableLegacyReports'
import { parseLegacyGrantReports } from './src/utils/main/grantReportLinks'

const BASE = 'https://api.airtable.com/v0/appP2zUc6VKh79IBD'
const headers = { Authorization: `Bearer ${process.env.AIRTABLE_API_TOKEN}` }

async function all(table: string, fields: string[]) {
  const out: any[] = []
  let offset: string | undefined
  do {
    const params = new URLSearchParams({ returnFieldsByFieldId: 'true' })
    fields.forEach((f) => params.append('fields[]', f))
    if (offset) params.set('offset', offset)
    const response = await fetch(`${BASE}/${table}?${params}`, { headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json()
    out.push(...body.records)
    offset = body.offset
  } while (offset)
  return out
}

function reason(message: string): string {
  if (message.includes('different links')) return 'duplicate report, different links'
  if (message.includes('more text')) return 'more text in cell'
  if (message.includes('a link, got text')) return 'not a link'
  if (message.includes('a link to')) return 'other site or http'
  if (message.includes('"Projects"')) return 'projects'
  return 'other'
}

const rows = await all('tblrHejb5zgUggFm2', legacyReportFieldIdsToFetch())
const { reports, skipped } = toLegacyGrantReports(rows)
const reasons: Record<string, number> = {}
for (const message of skipped) reasons[reason(message)] = (reasons[reason(message)] ?? 0) + 1
console.log(`rows ${rows.length}, reports kept ${reports.length}, skipped ${skipped.length}`)
console.log(`skipped by reason: ${JSON.stringify(reasons)}`)

const projects = await all('tbliw87UgsAYRAexr', ['fldI1myVN2uQs6Lqz'])
const directory = new Set(
  projects
    .filter((r) => r.fields.fldI1myVN2uQs6Lqz === 'Published on Website')
    .map((r) => r.id)
)
const kept = reports.filter((r) => directory.has(r.grantId))
const grants = new Set(kept.map((r) => r.grantId))
console.log(`directory: ${kept.length} reports on ${grants.size} of ${directory.size} grants`)
const perGrant: Record<string, number> = {}
for (const id of directory) {
  const n = kept.filter((r) => r.grantId === id).length
  const key = n >= 5 ? '5+' : String(n)
  perGrant[key] = (perGrant[key] ?? 0) + 1
}
console.log(`links per directory grant: ${JSON.stringify(perGrant)}`)
const parsed = parseLegacyGrantReports(JSON.parse(JSON.stringify(kept)))
console.log(`site reader: ${parsed instanceof Error ? 'FAILED ' + parsed.message.split(':')[0] : 'ok, ' + parsed.length}`)
