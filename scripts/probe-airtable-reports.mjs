// Temporary probe for INTORG-1305. Do not merge.
//
// Checks if AIRTABLE_API_TOKEN can read the grant report tables, and shows the
// shape of the image attachments. The repo is public, so the run log is public.
// The script prints metadata only: scopes, table and field names, types,
// counts and attachment dimensions. It never prints record values or URLs.

const BASE_ID = 'appP2zUc6VKh79IBD' // Grantee Manager - working
const API = 'https://api.airtable.com/v0'
const SAMPLE_RECORDS = 10

const TABLES = {
  published: 'Published Reports',
  submitted: 'Submitted Reports',
  grantees: 'Grantees'
}

// Non-Public fields that the report sync needs, from PRO-370.
const NEEDED_FIELDS = new Set([
  'Publication Status',
  'Published Date',
  'Source Submission',
  'Report ID',
  'Report Format',
  'Project ID',
  'Report Number',
  'Report Type',
  'Project Name'
])

const token = process.env.AIRTABLE_API_TOKEN
if (!token) {
  console.error('AIRTABLE_API_TOKEN is not set.')
  process.exit(1)
}

async function get(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const body = response.ok ? await response.json() : null
  return { status: response.status, body }
}

// Names in PRO-370 do not all match Airtable, so also show near matches.
const NEAR_MATCH = /report|project|status/i

function isSyncField(field) {
  return (
    field.name.startsWith('Public') ||
    NEEDED_FIELDS.has(field.name) ||
    NEAR_MATCH.test(field.name)
  )
}

function describeChoices(field) {
  const choices = field.options?.choices
  return choices ? ` choices: ${choices.map((c) => c.name).join(' | ')}` : ''
}

function findTable(tables, name) {
  return tables.find((t) => t.name.toLowerCase() === name.toLowerCase())
}

function printFields(table) {
  // Grantees (PRO-371) is new and has no private fields listed, so show all names.
  const showAll = table.name === TABLES.grantees
  const shown = showAll ? table.fields : table.fields.filter(isSyncField)
  console.log(`\n## ${table.name} (${table.id})`)
  console.log(`Fields used by the sync (${shown.length}):`)
  for (const field of shown) {
    console.log(`  - ${field.name} [${field.type}] ${field.id}${describeChoices(field)}`)
  }
  console.log(`Other fields, names hidden: ${table.fields.length - shown.length}`)
  console.log('Views:')
  const nameById = new Map(table.fields.map((f) => [f.id, f.name]))
  for (const view of table.views) {
    console.log(`  - ${view.name} [${view.type}] ${view.id}`)
    if (!/public/i.test(view.name) || !view.visibleFieldIds) continue
    for (const id of view.visibleFieldIds) {
      console.log(`      visible: ${nameById.get(id) ?? '?'} ${id}`)
    }
  }
}

function describeAttachment(attachment) {
  const thumbs = attachment.thumbnails
    ? Object.keys(attachment.thumbnails).join('/')
    : 'none'
  const size = `${(attachment.size / 1024 / 1024).toFixed(2)} MB`
  const dims = attachment.width ? `${attachment.width}x${attachment.height}` : 'no dims'
  return `${attachment.type}, ${size}, ${dims}, thumbnails: ${thumbs}`
}

async function probeImages(table, prefix = 'Public') {
  console.log(`\n## Attachments in ${table.name}`)
  const imageFields = table.fields.filter(
    (f) => f.type === 'multipleAttachments' && f.name.startsWith(prefix)
  )
  if (imageFields.length === 0) {
    console.log('\nNo Public attachment fields found.')
    return
  }

  const params = new URLSearchParams({
    maxRecords: String(SAMPLE_RECORDS),
    returnFieldsByFieldId: 'true'
  })
  imageFields.forEach((f) => params.append('fields[]', f.id))
  const { status, body } = await get(`/${BASE_ID}/${table.id}?${params}`)
  console.log(`\nRead records: HTTP ${status}`)
  if (!body) return

  console.log(`Sample records: ${body.records.length}`)
  body.records.forEach((record, index) => {
    for (const field of imageFields) {
      const attachments = record.fields[field.id] ?? []
      if (attachments.length === 0) continue
      console.log(`  record ${index + 1}, ${field.name}: ${attachments.length} file(s)`)
      attachments.forEach((a) => console.log(`    - ${describeAttachment(a)}`))
    }
  })
}

async function countLive(table) {
  const statusField = table.fields.find((f) => f.name === 'Publication Status')
  if (!statusField) {
    console.log('\nNo "Publication Status" field, so no Live count.')
    return
  }
  let total = 0
  let offset
  do {
    const params = new URLSearchParams({
      filterByFormula: `{Publication Status} = 'Live'`,
      'fields[]': statusField.id
    })
    if (offset) params.set('offset', offset)
    const { status, body } = await get(`/${BASE_ID}/${table.id}?${params}`)
    if (!body) {
      console.log(`\nCount Live records: HTTP ${status}`)
      return
    }
    total += body.records.length
    offset = body.offset
  } while (offset)
  console.log(`\nRecords with Publication Status = Live: ${total}`)
}

async function countView(table) {
  const view = table.views.find((v) => v.name.startsWith('PUBLIC'))
  if (!view) {
    console.log('\nNo PUBLIC view found.')
    return
  }
  const params = new URLSearchParams({ view: view.id, 'fields[]': table.primaryFieldId })
  const { status, body } = await get(`/${BASE_ID}/${table.id}?${params}`)
  console.log(`\nRecords in view "${view.name}": HTTP ${status}, ${body?.records.length ?? 0} (first page)`)
}

function shapeOf(value) {
  if (value === undefined) return 'missing'
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    const inner = [...new Set(value.map((v) => (typeof v === 'object' ? 'object' : typeof v)))]
    return `array<${inner.join('|') || 'empty'}>`
  }
  if (typeof value === 'object') return `object{${Object.keys(value).join(',')}}`
  return typeof value
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

// Counts only. The repo is public, so no value is printed.
async function profileShapes(table) {
  const records = []
  let offset
  do {
    const params = new URLSearchParams({ returnFieldsByFieldId: 'true' })
    if (offset) params.set('offset', offset)
    const { status, body } = await get(`/${BASE_ID}/${table.id}?${params}`)
    if (!body) {
      console.log(`Grantees read: HTTP ${status}`)
      return
    }
    records.push(...body.records)
    offset = body.offset
  } while (offset)
  console.log(`\n## Grantees value shapes (${records.length} records)`)
  for (const field of table.fields) {
    const counts = {}
    for (const r of records) {
      const shape = shapeOf(r.fields[field.id])
      counts[shape] = (counts[shape] ?? 0) + 1
    }
    console.log(`  - ${field.name}: ${JSON.stringify(counts)}`)
  }
  const byName = Object.fromEntries(table.fields.map((f) => [f.name, f.id]))
  const slugs = records.map((r) => r.fields[byName.Slug])
  const badSlugs = slugs.filter((s) => typeof s !== 'string' || !SLUG_PATTERN.test(s)).length
  const dupSlugs = slugs.length - new Set(slugs).size
  console.log(`Slugs not matching ${SLUG_PATTERN}: ${badSlugs}. Duplicate slugs: ${dupSlugs}`)
  for (const name of ['Website', 'X / Twitter', 'LinkedIn', 'Bluesky']) {
    const values = records.map((r) => r.fields[byName[name]]).filter((v) => v !== undefined)
    console.log(`${name}: ${values.length} set, ${values.filter((v) => !isHttpUrl(v)).length} not http(s)`)
  }
  const tags = records.map((r) => r.fields[byName['Thematic Tags']]).filter((v) => typeof v === 'string')
  const withDupes = tags.filter((t) => {
    const parts = t.split(',').map((p) => p.trim()).filter(Boolean)
    return parts.length !== new Set(parts).size
  }).length
  console.log(`Thematic Tags strings: ${tags.length}, with duplicates: ${withDupes}`)
  const names = records.map((r) => r.fields[byName.Name])
  console.log(`Duplicate names: ${names.length - new Set(names).size}`)
}

async function main() {
  const whoami = await get('/meta/whoami')
  console.log(`whoami: HTTP ${whoami.status}`)
  console.log(`scopes: ${whoami.body?.scopes?.join(', ') ?? 'not returned'}`)

  const meta = await get(`/meta/bases/${BASE_ID}/tables?include=visibleFieldIds`)
  console.log(`base schema: HTTP ${meta.status}`)
  if (!meta.body) process.exit(1)

  const tables = meta.body.tables
  console.log(`Tables in base: ${tables.map((t) => t.name).join(', ')}`)

  for (const name of Object.values(TABLES)) {
    const table = findTable(tables, name)
    if (!table) {
      console.log(`\nMISSING table: ${name}`)
      continue
    }
    printFields(table)
  }

  const grantees = findTable(tables, TABLES.grantees)
  if (grantees) {
    await probeImages(grantees, 'Logo')
    await profileShapes(grantees)
  }

  const published = findTable(tables, TABLES.published)
  if (!published) return
  await countLive(published)
  await countView(published)
  await probeImages(published)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
