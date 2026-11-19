// Counts only: the probe output is public. Copied into the site's src/ and run
// with vitest after the sync, because grantee.ts needs Vite (import.meta.glob).
import fs from 'node:fs'
import { it } from 'vitest'
import { parseGranteeRecords } from './utils/main/grantee'

it('counts grant periods', () => {

const raw = JSON.parse(
  fs.readFileSync('src/data/airtable/grantee-data.json', 'utf8')
) as { fields: Record<string, unknown> }[]
const endDates = raw.map((r) => r.fields['End Date'])
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
console.log(`published grants: ${raw.length}`)
console.log(`End Date set: ${endDates.filter((v) => v !== undefined).length}`)
console.log(`End Date shaped YYYY-MM-DD: ${endDates.filter(isDate).length}`)
console.log(`End Date other shape: ${endDates.filter((v) => v !== undefined && !isDate(v)).length}`)
const startOk = raw.filter((r) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(r.fields['Start Month'] ?? ''))).length
console.log(`Start Month shaped YYYY-MM: ${startOk}`)
const reversed = raw.filter((r) => {
  const s = String(r.fields['Start Month'] ?? ''), e = String(r.fields['End Date'] ?? '').slice(0, 7)
  return isDate(r.fields['End Date']) && /^\d{4}-\d{2}$/.test(s) && e < s
}).length
console.log(`end before start: ${reversed}`)
for (const locale of ['en', 'es'] as const) {
  const grantees = parseGranteeRecords(raw, locale)
  if (grantees instanceof Error) throw grantees
  const shown = grantees.filter((g) => g.grantPeriodLabel !== '').length
  console.log(`${locale}: grant period shown ${shown}, hidden ${grantees.length - shown}`)
}
})
