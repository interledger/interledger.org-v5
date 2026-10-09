import type {
  AirtableFieldValue,
  Field,
  RawTableRecord,
  TableRecord
} from '@/types/airtable'

// Record-shaping helpers for scripts/import-airtable.ts. Airtable omits empty
// cells, so a missing value is normal. A value of the wrong shape on one
// record is a data gap: warned about and left out of grantee-data.json. A
// published column missing or blank on every published record means the
// schema broke, and fails the sync, as does having no published records.

type FieldShape = 'string' | 'number' | 'string | number' | 'string[]'

// The Projects columns the site renders, by field ID so a rename in Airtable
// leaves the output unchanged. Names are the keys written to grantee-data.json
// and read by grantee.ts; shapes are the values the sync accepts. Year takes a
// number too, since it is a formula and grantee.ts renders either.
//
// A column listed here is written to grantee-data.json, which is committed,
// whenever it is visible in the view. Never add `Project` (fldirPGzYo96I1Hsu):
// it must never be published and must not reach git, visible or not.
export const GRANTEE_FIELDS = {
  'Project Name': { id: 'fldSwFK4pUppTuSRL', shape: 'string' },
  'Secondary Grant Program Name': { id: 'fldH4NUS3BL5SV8rN', shape: 'string' },
  Year: { id: 'fldEZNEXAY5steLCx', shape: 'string | number' },
  'Start Month': { id: 'fldo7Z20rohFRZSP3', shape: 'string' },
  Country: { id: 'fldkBJh5jGlkQyM9r', shape: 'string' },
  'Project Leader': { id: 'fldKLOR55uQPb5BHG', shape: 'string[]' },
  'Thematic Tag': { id: 'fldu3IXvMaQ4TXLTe', shape: 'string[]' },
  'Project Description': { id: 'fld8Of70JLLlq4xzJ', shape: 'string' },
  'Total budget approved': { id: 'flds9Vz8WMbt4ALzR', shape: 'number' },
  'Project Links': { id: 'flducePQXMCeH9I3q', shape: 'string[]' }
} as const satisfies Record<string, { id: string; shape: FieldShape }>

export type GranteeFieldName = keyof typeof GRANTEE_FIELDS

const PROJECT_NAME: GranteeFieldName = 'Project Name'
const PROJECT_LEADER: GranteeFieldName = 'Project Leader'
const PUBLISHED_ON_WEBSITE_VALUE = 'Published on Website'

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

// Checked by value rather than by the field's metadata type: a formula keeps
// type `formula` while its result type changes.
function matchesShape(
  value: unknown,
  shape: FieldShape
): value is AirtableFieldValue {
  if (shape === 'string[]') return isStringArray(value)
  if (shape === 'string | number') {
    return typeof value === 'string' || typeof value === 'number'
  }
  return typeof value === shape
}

function describeShape(value: unknown): string {
  if (value === null) return 'null'
  if (isStringArray(value)) return 'string[]'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

// A broken Airtable formula/rollup returns { error: '#ERROR!' } instead of a
// string/number; an invalid numeric result (e.g. divide-by-zero) returns
// { specialValue: 'NaN' } instead. Both are error shapes, just under
// different keys.
function airtableFormulaErrorReason(value: unknown): string | undefined {
  if (!isRecordLike(value)) return undefined
  if (typeof value.error === 'string') return value.error
  if (typeof value.specialValue === 'string') return value.specialValue
  return undefined
}

// Use the project name in warnings so they're recognisable at a glance instead of a bare record ID.
function recordLabel(id: string, projectName: unknown): string {
  return typeof projectName === 'string' ? `${projectName} (ID: ${id})` : id
}

// Blank as grantee.ts sees it: it trims strings and drops blank list items.
function isBlank(value: AirtableFieldValue | undefined): boolean {
  if (value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  return Array.isArray(value) && value.every((item) => item.trim() === '')
}

export function isRawTableRecord(value: unknown): value is RawTableRecord {
  if (!isRecordLike(value)) return false
  if (typeof value.id !== 'string' || typeof value.createdTime !== 'string')
    return false
  return isRecordLike(value.fields)
}

// Only records marked 'Published on Website' in Airtable are written to grantee-data.json.
export function filterPublishedRecords(
  records: RawTableRecord[],
  publishedOnWebsiteFieldId: string
): RawTableRecord[] {
  const published = records.filter(
    (record) =>
      record.fields[publishedOnWebsiteFieldId] === PUBLISHED_ON_WEBSITE_VALUE
  )
  if (records.length > 0 && published.length === 0) {
    throw new Error(
      `${PUBLISHED_ON_WEBSITE_VALUE} filter matched 0 of ${records.length} records — refusing to write an empty grantee directory`
    )
  }
  return published
}

// Keeps only the GRANTEE_FIELDS columns, renamed from field ID to column name
// and in map order. A value of the wrong shape is warned about and dropped.
export function toGranteeRecord(raw: RawTableRecord): TableRecord {
  const label = recordLabel(raw.id, raw.fields[GRANTEE_FIELDS[PROJECT_NAME].id])
  const fields: TableRecord['fields'] = {}

  for (const [name, { id, shape }] of Object.entries(GRANTEE_FIELDS)) {
    if (!(id in raw.fields)) continue
    const value = raw.fields[id]
    if (matchesShape(value, shape)) {
      fields[name] = value
      continue
    }
    const reason = airtableFormulaErrorReason(value)
    const problem =
      reason === undefined
        ? `Unexpected value (expected ${shape}, got ${describeShape(value)})`
        : `Formula error (${reason})`
    console.warn(
      `⚠️  ${problem} in field "${name}" for record ${label} — field omitted`
    )
  }

  return { id: raw.id, createdTime: raw.createdTime, fields }
}

// Contacts with no name are skipped silently: most are never linked from a
// published project, and resolveProjectLeaders warns about those that are.
export function buildContactNameMap(
  contactRecords: RawTableRecord[],
  nameFieldId: string
): Map<string, string> {
  const contactsMap = new Map<string, string>()
  for (const record of contactRecords) {
    const name = record.fields[nameFieldId]
    if (typeof name !== 'string' || name.trim() === '') continue
    contactsMap.set(record.id, name)
  }
  return contactsMap
}

function withoutField(record: TableRecord, fieldName: string): TableRecord {
  const fields = { ...record.fields }
  delete fields[fieldName]
  return { ...record, fields }
}

// Airtable returns linked records as IDs; replace Project Leader IDs with
// contact names, dropping any ID that has no named contact.
export function resolveProjectLeaders(
  granteeData: TableRecord[],
  contactsMap: Map<string, string>
): TableRecord[] {
  return granteeData.map((record) => {
    const leaderIds = record.fields[PROJECT_LEADER]
    // Not an array only when absent: toGranteeRecord keeps nothing but a string[] here.
    if (!Array.isArray(leaderIds)) return record

    const leaderNames = leaderIds.flatMap((id) => contactsMap.get(id) ?? [])
    const unresolvedIds = leaderIds.filter((id) => !contactsMap.has(id))
    if (unresolvedIds.length > 0) {
      const label = recordLabel(record.id, record.fields[PROJECT_NAME])
      console.warn(
        `⚠️  No contact name for "${PROJECT_LEADER}" ${unresolvedIds.join(', ')} in record ${label} — leader omitted`
      )
    }
    if (leaderNames.length === 0) {
      return withoutField(record, PROJECT_LEADER)
    }
    return {
      ...record,
      fields: { ...record.fields, [PROJECT_LEADER]: leaderNames }
    }
  })
}

// A rendered column is published only while it is visible in the view, so
// editors can take one off the site by hiding it. Project Name can't be
// hidden: the site drops every grantee without one.
export function selectPublishedGranteeFields(visibleFieldIds: string[]): {
  published: GranteeFieldName[]
  hidden: GranteeFieldName[]
} {
  const names = Object.keys(GRANTEE_FIELDS) as GranteeFieldName[]
  const isVisible = (name: GranteeFieldName) =>
    visibleFieldIds.includes(GRANTEE_FIELDS[name].id)
  if (!isVisible(PROJECT_NAME)) {
    throw new Error(
      `"${PROJECT_NAME}" is hidden in the view — refusing to write a grantee directory with no names`
    )
  }
  return {
    published: names.filter(isVisible),
    hidden: names.filter((name) => !isVisible(name))
  }
}

// One record missing a column is a data gap; every record missing it means
// the schema broke, and writing the file would empty that column on the site.
// No records at all (e.g. the view's filter changed) would empty the directory.
export function assertGranteeFieldsPresent(
  records: TableRecord[],
  publishedFields: GranteeFieldName[]
): void {
  if (records.length === 0) {
    throw new Error(
      'No published records — refusing to write an empty grantee directory'
    )
  }
  const missing = publishedFields.filter((name) =>
    records.every((record) => isBlank(record.fields[name]))
  )
  if (missing.length === 0) return
  throw new Error(
    `No published record has a value for ${missing.map((name) => `"${name}"`).join(', ')} — ` +
      `the field's type may have changed, its formula may fail in every row, or no linked record resolved`
  )
}

// Columns are read by ID, so a rename in Airtable changes nothing in the
// output. It does leave the name in code (and in grantee-data.json and the
// sync's warnings) out of step with what editors see, so it is reported.
export function findRenamedFields(
  expected: { name: string; id: string }[],
  fields: Field[]
): { name: string; airtableName: string }[] {
  return expected.flatMap(({ name, id }) => {
    const airtableName = fields.find((field) => field.id === id)?.name
    return airtableName === undefined || airtableName === name
      ? []
      : [{ name, airtableName }]
  })
}

// Names the view's visible columns that never reach grantee-data.json, so a
// column an editor adds to the view shows up in the sync log instead of vanishing.
export function listUnrenderedViewFields(
  visibleFieldIds: string[],
  fields: Field[]
): string[] {
  const renderedFieldIds: string[] = Object.values(GRANTEE_FIELDS).map(
    ({ id }) => id
  )
  return visibleFieldIds
    .filter((id) => !renderedFieldIds.includes(id))
    .map((id) => fields.find((field) => field.id === id)?.name ?? id)
}

// The site drops a grantee with no name, so flag published records missing one
// while it can still be fixed in Airtable. The record is still written.
export function warnOnMissingProjectNames(records: TableRecord[]): void {
  for (const record of records) {
    const name = record.fields[PROJECT_NAME]
    if (typeof name === 'string' && name.trim() !== '') continue
    console.warn(
      `⚠️  Published record ${record.id} has no "${PROJECT_NAME}" — it will not appear in the grantee directory`
    )
  }
}
