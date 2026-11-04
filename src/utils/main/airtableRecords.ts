import type {
  AirtableFieldValue,
  Field,
  RawTableRecord,
  TableRecord
} from '@/types/airtable'
// nonBlankString is a name as the site sees it: grantee.ts trims, and drops a blank one.
import {
  formatProblems,
  isRecordLike,
  isStringArray,
  nonBlankString,
  partitionRecordResults,
  recordProblemsError
} from './airtableFieldValues'

// Record-shaping helpers for scripts/import-airtable.ts. Airtable omits empty
// cells, so a missing value is normal, except for Project Name. A published
// record with no Project Name, a value of the wrong shape, a formula error or
// a leader with no contact name fails the sync, with every bad record listed.
// A published column blank on every published record means the column was
// emptied or its formula broke, and fails the sync too, as does having no
// published records.

type FieldShape = 'string' | 'number' | 'string | number' | 'string[]'

interface GranteeFieldSpec {
  id: string
  shape: FieldShape
  required?: true
}

// The Projects columns the site renders, by field ID so a rename in Airtable
// leaves the output unchanged. Names are the keys written to grantee-data.json
// and read by grantee.ts; shapes are the values the sync accepts. Year takes a
// number too, since it is a formula and grantee.ts renders either. Project
// Name is the only required column: the site drops a grantee without one.
//
// A column listed here is written to grantee-data.json, which is committed,
// whenever it is visible in the view. Never add `Project` (fldirPGzYo96I1Hsu):
// it must never be published and must not reach git, visible or not.
export const GRANTEE_FIELDS = {
  'Project Name': { id: 'fldSwFK4pUppTuSRL', shape: 'string', required: true },
  'Secondary Grant Program Name': { id: 'fldH4NUS3BL5SV8rN', shape: 'string' },
  Year: { id: 'fldEZNEXAY5steLCx', shape: 'string | number' },
  'Start Month': { id: 'fldo7Z20rohFRZSP3', shape: 'string' },
  Country: { id: 'fldkBJh5jGlkQyM9r', shape: 'string' },
  'Project Leader': { id: 'fldKLOR55uQPb5BHG', shape: 'string[]' },
  'Thematic Tag': { id: 'fldu3IXvMaQ4TXLTe', shape: 'string[]' },
  'Project Description': { id: 'fld8Of70JLLlq4xzJ', shape: 'string' },
  'Total budget approved': { id: 'flds9Vz8WMbt4ALzR', shape: 'number' },
  'Project Links': { id: 'flducePQXMCeH9I3q', shape: 'string[]' }
} as const satisfies Record<string, GranteeFieldSpec>

export type GranteeFieldName = keyof typeof GRANTEE_FIELDS

const PROJECT_NAME: GranteeFieldName = 'Project Name'
const PROJECT_LEADER: GranteeFieldName = 'Project Leader'
const PUBLISHED_ON_WEBSITE_VALUE = 'Published on Website'

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

// Use the project name in errors so they're recognisable at a glance instead of a bare record ID.
function recordLabel(id: string, projectName: unknown): string {
  const name = nonBlankString(projectName)
  return name === undefined ? id : `${name} (ID: ${id})`
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
): RawTableRecord[] | Error {
  const published = records.filter(
    (record) =>
      record.fields[publishedOnWebsiteFieldId] === PUBLISHED_ON_WEBSITE_VALUE
  )
  if (records.length > 0 && published.length === 0) {
    return new Error(
      `${PUBLISHED_ON_WEBSITE_VALUE} filter matched 0 of ${records.length} records — refusing to write an empty grantee directory`
    )
  }
  return published
}

// Airtable returns linked records as IDs; the site shows the contacts' names.
function nameProjectLeaders(
  ids: string[],
  contactNames: ReadonlyMap<string, string>
): string[] | Error {
  const unresolved = ids.filter((id) => !contactNames.has(id))
  if (unresolved.length > 0) {
    return new Error(`no contact name for ${unresolved.join(', ')}`)
  }
  return ids.flatMap((id) => contactNames.get(id) ?? [])
}

// The value written for one column, undefined for an empty optional cell, or
// the problem that fails the sync.
function readGranteeColumn(
  name: string,
  { shape, required }: GranteeFieldSpec,
  value: unknown,
  contactNames: ReadonlyMap<string, string>
): AirtableFieldValue | undefined | Error {
  if (value === undefined) return required ? new Error('missing') : undefined
  if (!matchesShape(value, shape)) {
    const reason = airtableFormulaErrorReason(value)
    return new Error(
      reason === undefined
        ? `expected ${shape}, got ${describeShape(value)}`
        : `formula error (${reason})`
    )
  }
  if (required && isBlank(value)) return new Error('missing')
  if (name === PROJECT_LEADER && Array.isArray(value)) {
    return nameProjectLeaders(value, contactNames)
  }
  return value
}

// Keeps only the GRANTEE_FIELDS columns, renamed from field ID to column name
// and in map order. Every problem in the record is listed, so programs can fix
// it in one pass.
export function toGranteeRecord(
  raw: RawTableRecord,
  contactNames: ReadonlyMap<string, string>
): TableRecord | Error {
  const fields: TableRecord['fields'] = {}
  const problems: string[] = []
  const columns: [string, GranteeFieldSpec][] = Object.entries(GRANTEE_FIELDS)

  for (const [name, spec] of columns) {
    const value = readGranteeColumn(
      name,
      spec,
      raw.fields[spec.id],
      contactNames
    )
    if (value instanceof Error) problems.push(`"${name}": ${value.message}`)
    else if (value !== undefined) fields[name] = value
  }

  if (problems.length === 0) {
    return { id: raw.id, createdTime: raw.createdTime, fields }
  }
  const label = recordLabel(raw.id, raw.fields[GRANTEE_FIELDS[PROJECT_NAME].id])
  return new Error(formatProblems(`Record ${label}`, problems))
}

// Shapes every published record. One bad record fails the whole set, with
// every bad record listed.
export function toGranteeRecords(
  records: RawTableRecord[],
  contactNames: ReadonlyMap<string, string>
): TableRecord[] | Error {
  const { values, problems } = partitionRecordResults(
    records.map((record) => toGranteeRecord(record, contactNames))
  )
  if (problems.length > 0) {
    return recordProblemsError(problems, 'record(s) cannot be published')
  }
  return values
}

// Contacts with no name are skipped silently: most are never linked from a
// published project, and toGranteeRecord fails on those that are.
export function buildContactNameMap(
  contactRecords: RawTableRecord[],
  nameFieldId: string
): Map<string, string> {
  const contactsMap = new Map<string, string>()
  for (const record of contactRecords) {
    const name = nonBlankString(record.fields[nameFieldId])
    if (name === undefined) continue
    contactsMap.set(record.id, name)
  }
  return contactsMap
}

// A rendered column is published only while it is visible in the view, so
// editors can take one off the site by hiding it. Project Name can't be
// hidden: the site drops every grantee without one.
export function selectPublishedGranteeFields(visibleFieldIds: string[]):
  | {
      published: GranteeFieldName[]
      hidden: GranteeFieldName[]
    }
  | Error {
  const names = Object.keys(GRANTEE_FIELDS) as GranteeFieldName[]
  const isVisible = (name: GranteeFieldName) =>
    visibleFieldIds.includes(GRANTEE_FIELDS[name].id)
  if (!isVisible(PROJECT_NAME)) {
    return new Error(
      `"${PROJECT_NAME}" is hidden in the view — refusing to write a grantee directory with no names`
    )
  }
  return {
    published: names.filter(isVisible),
    hidden: names.filter((name) => !isVisible(name))
  }
}

// One record without a value in an optional column is normal; every record
// without one means the column was emptied or its formula broke, and writing
// the file would empty that column on the site. No records at all (e.g. the
// view's filter changed) would empty the directory.
export function checkGranteeFieldsPresent(
  records: TableRecord[],
  publishedFields: GranteeFieldName[]
): undefined | Error {
  if (records.length === 0) {
    return new Error(
      'No published records — refusing to write an empty grantee directory'
    )
  }
  const missing = publishedFields.filter((name) =>
    records.every((record) => isBlank(record.fields[name]))
  )
  if (missing.length === 0) return undefined
  return new Error(
    `No published record has a value for ${missing.map((name) => `"${name}"`).join(', ')} — ` +
      `the column may have been emptied, or its formula returns a blank value in every row`
  )
}

// Columns are read by ID, so a rename in Airtable changes nothing in the
// output. It does leave the name in code (and in grantee-data.json and the
// sync's error messages) out of step with what editors see, so it is reported.
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
