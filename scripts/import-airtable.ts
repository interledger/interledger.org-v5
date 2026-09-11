import 'dotenv/config'
import path from 'node:path'
import fs from 'fs/promises'
import * as prettier from 'prettier'
import type { TableMeta, Table, View, TableRecord } from '@/types/airtable'

const BASE_ID = 'appP2zUc6VKh79IBD' // Grantee Manager - working
const PROJECTS_TABLE_ID = 'tbliw87UgsAYRAexr' // Projects
const VIEW_ID = 'viwE6kqV1lvcIz2Ms' // Directory Data View April 2026
const CONTACTS_TABLE_ID = 'tbliIEy9J06bTV8Su' // Contacts
const EXCLUDED_FIELD_ID = 'fldirPGzYo96I1Hsu' // Project field in Projects table
const PROJECT_LEADER_FIELD_ID = 'fldKLOR55uQPb5BHG' // Project Leader field in Projects table
const PUBLISHED_ON_WEBSITE_FIELD_ID = 'fldI1myVN2uQs6Lqz' // Published on Website field in Projects table
const PUBLISHED_ON_WEBSITE_VALUE = 'Published on Website'
const PROJECT_NAME_FIELD_NAME = 'Project Name'

function assertString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${context} to be a string, got ${typeof value}`)
  }
  return value
}

function findById<T extends { id: string }>(
  items: T[],
  id: string,
  what: string
): T {
  const found = items.find((item) => item.id === id)
  if (!found) {
    throw new Error(`${what} with ID '${id}' not found in Airtable metadata`)
  }
  return found
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

// Strips formula-error fields from a record in place, warning instead of
// failing the whole sync over one bad cell. Runs over every record
// unconditionally, before validation, so cleanup never depends on iteration
// order or short-circuiting.
function sanitizeFormulaErrors(value: unknown): void {
  if (!isRecordLike(value)) return
  if (!isRecordLike(value.fields)) return
  const fields = value.fields
  // Use the project name in warnings so they're recognisable at a glance instead of a bare record ID.
  const projectName = fields[PROJECT_NAME_FIELD_NAME]
  const recordLabel =
    typeof projectName === 'string'
      ? `${projectName} (ID: ${value.id})`
      : value.id

  for (const key in fields) {
    const reason = airtableFormulaErrorReason(fields[key])
    if (reason === undefined) continue
    console.warn(
      `⚠️  Formula error in field "${key}" for record ${recordLabel}: ${reason} — field omitted`
    )
    delete fields[key]
  }
}

function isTableRecord(value: unknown): value is TableRecord {
  if (!isRecordLike(value)) return false
  if (typeof value.id !== 'string' || typeof value.createdTime !== 'string')
    return false
  if (!isRecordLike(value.fields)) return false
  const fields = value.fields
  for (const key in fields) {
    const fieldValue = fields[key]
    if (
      typeof fieldValue !== 'string' &&
      typeof fieldValue !== 'number' &&
      (!Array.isArray(fieldValue) ||
        !fieldValue.every((item) => typeof item === 'string'))
    ) {
      return false
    }
  }
  return true
}

async function writeAirtableJson(data: TableRecord[]) {
  const basePath = path.resolve('./src/data/airtable')
  await fs.mkdir(basePath, { recursive: true })
  const filePath = path.join(basePath, 'grantee-data.json')

  // grantee-data.json is committed, and `pnpm run lint` runs `prettier --check` over it.
  // Prettier collapses short arrays that JSON.stringify always expands, so writing raw
  // stringify output would fail lint and bury every real change under thousands of lines
  // of formatting churn. Formatting here keeps a local run and the automated sync in
  // .github/workflows/strapi-rebuild-and-sync.yml byte-identical.
  const config = await prettier.resolveConfig(filePath)
  const formatted = await prettier.format(JSON.stringify(data, null, 2), {
    ...config,
    // .prettierrc's plugin list exists for .astro files only; loading it to format JSON
    // costs resolution work for identical output.
    plugins: [],
    filepath: filePath
  })

  await fs.writeFile(filePath, formatted)
  console.log(`✅ Saved Airtable data JSON: ${filePath}`)
}

// Only records marked 'Published on Website' in Airtable are written to grantee-data.json.
function filterPublishedRecords(
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
  return published.map((record) => {
    const fields = { ...record.fields }
    delete fields[publishedOnWebsiteFieldName]
    return { ...record, fields }
  })
}

function resolveProjectLeaders(
  granteeData: TableRecord[],
  contactsMap: Map<string, string>,
  projectLeaderFieldName: string
): TableRecord[] {
  const updatedData = granteeData.map((record) => {
    const leaderIds = record.fields[projectLeaderFieldName]
    if (leaderIds === undefined) return record
    if (!Array.isArray(leaderIds)) {
      throw new Error(
        `Unexpected format for ${projectLeaderFieldName} field in record ${record.id}: expected string[]`
      )
    }
    return {
      ...record,
      fields: {
        ...record.fields,
        [projectLeaderFieldName]: leaderIds.map(
          (id) => contactsMap.get(id) ?? 'Unknown'
        )
      }
    }
  })
  return updatedData
}

function throwUnexpectedShape(): never {
  throw new Error(
    `Unexpected response shape from Airtable: page.records is not TableRecord[]`
  )
}

async function fetchAllRecords(
  tableId: typeof CONTACTS_TABLE_ID | typeof PROJECTS_TABLE_ID,
  params: URLSearchParams,
  apiToken: string
): Promise<TableRecord[]> {
  const records: TableRecord[] = []
  let offset: string | undefined

  do {
    if (offset) params.set('offset', offset)
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiToken}` }
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Airtable data; Status: ${response.status} ${response.statusText}`
      )
    }

    const page = await response.json()
    if (!Array.isArray(page.records)) throwUnexpectedShape()
    page.records.forEach(sanitizeFormulaErrors)
    if (!page.records.every(isTableRecord)) throwUnexpectedShape()
    records.push(...page.records)
    offset = page.offset
  } while (offset)

  return records
}

async function mapContactIdsToNames(contactsTable: Table, apiToken: string) {
  const primaryFieldId = contactsTable.primaryFieldId
  const primaryFieldName = findById(
    contactsTable.fields,
    primaryFieldId,
    'Contacts primary field'
  ).name

  const params = new URLSearchParams()
  params.set('fields[]', primaryFieldId)
  const contactRecords = await fetchAllRecords(
    CONTACTS_TABLE_ID,
    params,
    apiToken
  )

  const contactsMap = new Map<string, string>(
    contactRecords.map((record) => [
      record.id,
      assertString(
        record.fields[primaryFieldName],
        `Contact record ${record.id} primary field value`
      )
    ])
  )
  return contactsMap
}

async function fetchGranteeRecords(view: View, apiToken: string) {
  // view = row filter (Airtable view's filters apply server-side)
  // fields[] = column filter (only return the view's visible fields)
  const params = new URLSearchParams({ view: VIEW_ID })
  view.visibleFieldIds
    ?.filter((id) => id !== EXCLUDED_FIELD_ID)
    .forEach((id) => params.append('fields[]', id))

  return fetchAllRecords(PROJECTS_TABLE_ID, params, apiToken)
}

async function importAirtableData() {
  const apiToken = process.env.AIRTABLE_API_TOKEN
  if (!apiToken) {
    throw new Error(
      'Missing Airtable configuration. Please set AIRTABLE_API_TOKEN in your environment variables.'
    )
  }

  const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables?include=visibleFieldIds`
  const meta: TableMeta = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` }
  }).then((r) => {
    if (!r.ok)
      throw new Error(
        `Failed to fetch Airtable metadata; Status: ${r.status} ${r.statusText}`
      )
    return r.json()
  })

  const contactsTable = findById(
    meta.tables,
    CONTACTS_TABLE_ID,
    'Contacts table'
  )
  const projectsTable = findById(
    meta.tables,
    PROJECTS_TABLE_ID,
    'Projects table'
  )
  const granteeView = findById(projectsTable.views, VIEW_ID, 'Grantee view')
  if (!granteeView.visibleFieldIds?.length) {
    throw new Error(`View '${VIEW_ID}' has no visible fields`)
  }
  const projectLeaderFieldName = findById(
    projectsTable.fields,
    PROJECT_LEADER_FIELD_ID,
    'Project Leader field'
  ).name
  const publishedOnWebsiteFieldName = findById(
    projectsTable.fields,
    PUBLISHED_ON_WEBSITE_FIELD_ID,
    'Published on Website field'
  ).name

  const allGranteeData: TableRecord[] = await fetchGranteeRecords(
    granteeView,
    apiToken
  )
  const granteeData = filterPublishedRecords(
    allGranteeData,
    publishedOnWebsiteFieldName
  )
  // Airtable returns linked records as IDs; resolve Project Leader IDs to contact names.
  const contactsMap = await mapContactIdsToNames(contactsTable, apiToken)
  const finalGranteeData = resolveProjectLeaders(
    granteeData,
    contactsMap,
    projectLeaderFieldName
  )
  await writeAirtableJson(finalGranteeData)
}

importAirtableData().catch((err) => {
  console.error(
    '❌ Error fetching Airtable data:',
    err instanceof Error ? err.message : err
  )
  process.exit(1)
})
