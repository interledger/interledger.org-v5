// Compare the PUBLIC views Jeremiah named (PRO-371 fd7a8291) with what the
// sync reads today. Counts and field metadata only: the probe output is
// public. No record values, no record IDs.
const token = process.env.AIRTABLE_API_TOKEN
const BASE = 'appP2zUc6VKh79IBD'
const headers = { Authorization: `Bearer ${token}` }

const PROJECTS = 'tbliw87UgsAYRAexr'
const OLD_PROJECTS_VIEW = 'viwE6kqV1lvcIz2Ms'
const PUBLISHED = 'fldI1myVN2uQs6Lqz'
// GRANTEE_FIELDS on staging, plus End Date (#884).
const GRANTEE_FIELD_IDS = [
  'fld8Of70JLLlq4xzJ', 'fldEZNEXAY5steLCx', 'fldH4NUS3BL5SV8rN',
  'fldKLOR55uQPb5BHG', 'fldSwFK4pUppTuSRL', 'fldkBJh5jGlkQyM9r',
  'fldo7Z20rohFRZSP3', 'flds9Vz8WMbt4ALzR', 'fldu3IXvMaQ4TXLTe',
  'flducePQXMCeH9I3q', 'fldjPAzO0s32QupTF'
]

const SUBMITTED = 'tblrHejb5zgUggFm2'
const LEGACY_FIELD_IDS = [
  'fldQ4TCd6pswVgajs', 'fldWRAATuUizgITyO', 'fldk6wRlmxfC9Ka0D', 'fld8UYDRTHeshaRSO'
]
const LEGACY_LINK = 'fldQ4TCd6pswVgajs'

async function get(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function all(table, params, fieldIds) {
  const records = []
  let offset
  do {
    const p = new URLSearchParams(params)
    for (const id of fieldIds) p.append('fields[]', id)
    p.set('returnFieldsByFieldId', 'true')
    if (offset) p.set('offset', offset)
    const page = await get(`https://api.airtable.com/v0/${BASE}/${table}?${p}`)
    records.push(...page.records)
    offset = page.offset
  } while (offset)
  return records
}

const meta = await get(`https://api.airtable.com/v0/meta/bases/${BASE}/tables?include=visibleFieldIds`)
const name = (table, id) => table.fields.find((f) => f.id === id)?.name ?? id

function describeView(table, view, wanted) {
  console.log(`view "${view.name}" (${view.id}), type ${view.type}, visible fields ${view.visibleFieldIds?.length}`)
  const missing = wanted.filter((id) => !view.visibleFieldIds?.includes(id))
  console.log(`  sync fields missing from the view: ${missing.length ? missing.map((id) => name(table, id)).join(', ') : 'none'}`)
  const extra = (view.visibleFieldIds ?? []).filter((id) => !wanted.includes(id))
  console.log(`  other visible fields (${extra.length}): ${extra.map((id) => name(table, id)).join(', ')}`)
}

function overlap(label, a, b) {
  const ids = new Set(b.map((r) => r.id))
  const both = a.filter((r) => ids.has(r.id)).length
  console.log(`  ${label}: ${both} in both, ${a.length - both} only in new, ${b.length - both} only in old`)
}

// Projects
const projects = meta.tables.find((t) => t.id === PROJECTS)
console.log('--- Projects views named PUBLIC')
for (const v of projects.views.filter((v) => /public/i.test(v.name))) console.log(`  ${v.id}  ${v.name}`)
const newProjectsView = projects.views.find((v) => /^projects\s*-\s*public\s*-\s*live on website$/i.test(v.name.trim()) || /^public\s*-\s*live on website$/i.test(v.name.trim()))
const oldProjectsView = projects.views.find((v) => v.id === OLD_PROJECTS_VIEW)
console.log('--- old Projects view')
describeView(projects, oldProjectsView, GRANTEE_FIELD_IDS)
if (!newProjectsView) {
  console.log('--- new Projects view: not found by name')
} else {
  console.log('--- new Projects view')
  describeView(projects, newProjectsView, GRANTEE_FIELD_IDS)
  const oldRecords = await all(PROJECTS, { view: OLD_PROJECTS_VIEW }, [PUBLISHED])
  const newRecords = await all(PROJECTS, { view: newProjectsView.id }, [PUBLISHED])
  const published = (rs) => rs.filter((r) => r.fields[PUBLISHED] !== undefined && r.fields[PUBLISHED] !== false).length
  console.log(`  records: new ${newRecords.length} (publish field set: ${published(newRecords)}), old ${oldRecords.length} (publish field set: ${published(oldRecords)})`)
  overlap('records', newRecords, oldRecords)
}

// Submitted Reports
const submitted = meta.tables.find((t) => t.id === SUBMITTED)
console.log('--- Submitted Reports views named PUBLIC')
for (const v of submitted.views.filter((v) => /public/i.test(v.name))) console.log(`  ${v.id}  ${v.name}`)
const newSubmittedView = submitted.views.find((v) => /public\s*-\s*live on website/i.test(v.name))
if (!newSubmittedView) {
  console.log('--- new Submitted Reports view: not found by name')
} else {
  console.log('--- new Submitted Reports view')
  describeView(submitted, newSubmittedView, LEGACY_FIELD_IDS)
  const inView = await all(SUBMITTED, { view: newSubmittedView.id }, [LEGACY_LINK])
  const inTable = await all(SUBMITTED, {}, [LEGACY_LINK])
  const linked = (rs) => rs.filter((r) => r.fields[LEGACY_LINK]).length
  console.log(`  records: view ${inView.length} (with a legacy link: ${linked(inView)}), table ${inTable.length} (with a legacy link: ${linked(inTable)})`)
  const viewIds = new Set(inView.map((r) => r.id))
  const linkedOutside = inTable.filter((r) => r.fields[LEGACY_LINK] && !viewIds.has(r.id)).length
  console.log(`  rows with a legacy link outside the view: ${linkedOutside}`)
}
