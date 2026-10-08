import type { AirtableFieldValue, TableRecord } from '@/types/airtable'

// Record-shaping helpers for scripts/import-airtable.ts. Airtable omits empty
// cells and can return shapes we don't write, so every field is treated as
// optional: a missing or unexpected value is warned about and left out of
// grantee-data.json, never failing the whole sync or written as a placeholder.

const PROJECT_NAME_FIELD_NAME = 'Project Name'
const PUBLISHED_ON_WEBSITE_VALUE = 'Published on Website'

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAirtableFieldValue(value: unknown): value is AirtableFieldValue {
  if (typeof value === 'string' || typeof value === 'number') return true
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
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
function recordLabel(id: unknown, fields: Record<string, unknown>): string {
  const projectName = fields[PROJECT_NAME_FIELD_NAME]
  return typeof projectName === 'string'
    ? `${projectName} (ID: ${String(id)})`
    : String(id)
}

// Strips every field whose value we don't write (formula errors, checkboxes,
// attachments, nulls…) from a record in place, warning instead of failing the
// whole sync over one bad cell. Runs over every record unconditionally, before
// validation, so cleanup never depends on iteration order or short-circuiting.
export function sanitizeRecordFields(value: unknown): void {
  if (!isRecordLike(value)) return
  if (!isRecordLike(value.fields)) return
  const fields = value.fields
  const label = recordLabel(value.id, fields)

  for (const key in fields) {
    const fieldValue = fields[key]
    if (isAirtableFieldValue(fieldValue)) continue
    const reason = airtableFormulaErrorReason(fieldValue)
    const problem =
      reason === undefined ? 'Unsupported value' : `Formula error (${reason})`
    console.warn(
      `⚠️  ${problem} in field "${key}" for record ${label} — field omitted`
    )
    delete fields[key]
  }
}

export function isTableRecord(value: unknown): value is TableRecord {
  if (!isRecordLike(value)) return false
  if (typeof value.id !== 'string' || typeof value.createdTime !== 'string')
    return false
  if (!isRecordLike(value.fields)) return false
  return Object.values(value.fields).every(isAirtableFieldValue)
}

// Contacts with no name are skipped, so any leader pointing at one is dropped
// by resolveProjectLeaders rather than written as a placeholder.
export function buildContactNameMap(
  contactRecords: TableRecord[],
  nameFieldName: string
): Map<string, string> {
  const contactsMap = new Map<string, string>()
  for (const record of contactRecords) {
    const name = record.fields[nameFieldName]
    if (typeof name !== 'string' || name.trim() === '') {
      console.warn(
        `⚠️  Contact record ${record.id} has no name ("${nameFieldName}" is empty) — omitted from any project's leaders`
      )
      continue
    }
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
  contactsMap: Map<string, string>,
  projectLeaderFieldName: string
): TableRecord[] {
  return granteeData.map((record) => {
    const leaderIds = record.fields[projectLeaderFieldName]
    if (leaderIds === undefined) return record
    const label = recordLabel(record.id, record.fields)

    if (!Array.isArray(leaderIds)) {
      console.warn(
        `⚠️  Unexpected format for "${projectLeaderFieldName}" in record ${label}: expected string[] — field omitted`
      )
      return withoutField(record, projectLeaderFieldName)
    }

    const leaderNames = leaderIds.flatMap((id) => contactsMap.get(id) ?? [])
    const unresolvedIds = leaderIds.filter((id) => !contactsMap.has(id))
    if (unresolvedIds.length > 0) {
      console.warn(
        `⚠️  No contact name for "${projectLeaderFieldName}" ${unresolvedIds.join(', ')} in record ${label} — leader omitted`
      )
    }
    if (leaderNames.length === 0) {
      return withoutField(record, projectLeaderFieldName)
    }
    return {
      ...record,
      fields: { ...record.fields, [projectLeaderFieldName]: leaderNames }
    }
  })
}

// The site drops a grantee with no name, so flag published records missing one
// while it can still be fixed in Airtable. The record is still written.
export function warnOnMissingProjectNames(records: TableRecord[]): void {
  for (const record of records) {
    const name = record.fields[PROJECT_NAME_FIELD_NAME]
    if (typeof name === 'string' && name.trim() !== '') continue
    console.warn(
      `⚠️  Published record ${record.id} has no "${PROJECT_NAME_FIELD_NAME}" — it will not appear in the grantee directory`
    )
  }
}

// Only records marked 'Published on Website' in Airtable are written to grantee-data.json.
export function filterPublishedRecords(
  data: TableRecord[],
  publishedOnWebsiteFieldName: string
): TableRecord[] {
  const published = data.filter(
    (record) =>
      record.fields[publishedOnWebsiteFieldName] === PUBLISHED_ON_WEBSITE_VALUE
  )
  if (data.length > 0 && published.length === 0) {
    throw new Error(
      `${PUBLISHED_ON_WEBSITE_VALUE} filter matched 0 of ${data.length} records — refusing to write an empty grantee directory`
    )
  }
  // Every remaining record is published by construction, so the flag is redundant — drop it to keep the written JSON smaller.
  return published.map((record) =>
    withoutField(record, publishedOnWebsiteFieldName)
  )
}
