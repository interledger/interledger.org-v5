// Why does the directory view return only 2 published grants? Counts and
// field metadata only: the probe output is public. No record values except the
// status labels of the publish field.
const token = process.env.AIRTABLE_API_TOKEN
const BASE = 'appP2zUc6VKh79IBD'
const PROJECTS = 'tbliw87UgsAYRAexr'
const VIEW = 'viwE6kqV1lvcIz2Ms'
const PUBLISHED = 'fldI1myVN2uQs6Lqz'
const headers = { Authorization: `Bearer ${token}` }

async function get(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function all(params) {
  const records = []
  let offset
  do {
    const p = new URLSearchParams(params)
    p.append('fields[]', PUBLISHED)
    p.set('returnFieldsByFieldId', 'true')
    if (offset) p.set('offset', offset)
    const page = await get(`https://api.airtable.com/v0/${BASE}/${PROJECTS}?${p}`)
    records.push(...page.records)
    offset = page.offset
  } while (offset)
  return records
}

function label(value) {
  if (value === undefined) return '(empty)'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `array of ${value.length}: ${JSON.stringify(value.filter((v) => typeof v === 'string'))}`
  if (value && typeof value === 'object') return `object keys ${Object.keys(value).join(',')}`
  return typeof value
}

function group(records) {
  const counts = new Map()
  for (const r of records) {
    const key = label(r.fields[PUBLISHED])
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${n}  ${k}`).join('\n')
}

const meta = await get(`https://api.airtable.com/v0/meta/bases/${BASE}/tables?include=visibleFieldIds`)
const table = meta.tables.find((t) => t.id === PROJECTS)
const field = table.fields.find((f) => f.id === PUBLISHED)
const view = table.views.find((v) => v.id === VIEW)
console.log('--- publish field metadata')
console.log(`name: ${field.name}, type: ${field.type}`)
if (field.options?.choices) console.log(`choices: ${field.options.choices.map((c) => JSON.stringify(c.name)).join(', ')}`)
if (field.options?.result) console.log(`result type: ${field.options.result.type}`)
if (field.options?.formula !== undefined) console.log('formula: (present, not printed)')
if (field.options?.referencedFieldIds) console.log(`references: ${field.options.referencedFieldIds.map((id) => table.fields.find((f) => f.id === id)?.name ?? id).join(', ')}`)
console.log(`--- view: ${view?.name}, type ${view?.type}, visible fields ${view?.visibleFieldIds?.length}, publish field visible: ${view?.visibleFieldIds?.includes(PUBLISHED)}`)

const inView = await all({ view: VIEW })
console.log(`--- records in the view: ${inView.length}`)
console.log(group(inView))
const inTable = await all({})
console.log(`--- records in the table: ${inTable.length}`)
console.log(group(inTable))
