import 'dotenv/config'
import path from 'node:path'
import fs from 'fs/promises'
import * as prettier from 'prettier'
import type {
  TableMeta,
  Table,
  TableRecord,
  RawTableRecord
} from '@/types/airtable'
// Direct path, not the @/utils barrel: the barrel pulls in astro:content chains a tsx script can't load.
import {
  GRANTEE_FIELDS,
  type GranteeFieldName,
  checkGranteeFieldsPresent,
  buildContactNameMap,
  filterPublishedRecords,
  findRenamedFields,
  isRawTableRecord,
  listUnrenderedViewFields,
  resolveProjectLeaders,
  selectPublishedGranteeFields,
  toGranteeRecord,
  warnOnMissingProjectNames
} from '../src/utils/main/airtableRecords'

const BASE_ID = 'appP2zUc6VKh79IBD' // Grantee Manager - working
const PROJECTS_TABLE_ID = 'tbliw87UgsAYRAexr' // Projects
const VIEW_ID = 'viwE6kqV1lvcIz2Ms' // Directory Data View April 2026
const CONTACTS_TABLE_ID = 'tbliIEy9J06bTV8Su' // Contacts
const PUBLISHED_ON_WEBSITE_FIELD_ID = 'fldI1myVN2uQs6Lqz' // Published on Website field in Projects table

// Every Projects column the sync can read, checked against the metadata. Which
// grantee columns are fetched depends on the view (see
// selectPublishedGranteeFields); the publish flag always is.
const READ_FIELDS: { name: string; id: string }[] = [
  ...Object.entries(GRANTEE_FIELDS).map(([name, { id }]) => ({ name, id })),
  { name: 'Published on Website', id: PUBLISHED_ON_WEBSITE_FIELD_ID }
]

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

async function writeAirtableJson(data: TableRecord[]) {
  const basePath = path.resolve('./src/data/airtable')
  await fs.mkdir(basePath, { recursive: true })
  const filePath = path.join(basePath, 'grantee-data.json')

  // grantee-data.json is committed, and `pnpm run lint` runs `prettier --check` over it.
  // Prettier collapses short arrays that JSON.stringify always expands, so writing raw
  // stringify output would fail lint and bury every real change under thousands of lines
  // of formatting churn. Formatting here keeps a local run and the automated sync in
  // .github/workflows/sync-airtable.yml byte-identical.
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

function throwUnexpectedShape(): never {
  throw new Error(
    `Unexpected response shape from Airtable: page.records is not RawTableRecord[]`
  )
}

async function fetchAllRecords(
  tableId: typeof CONTACTS_TABLE_ID | typeof PROJECTS_TABLE_ID,
  params: URLSearchParams,
  apiToken: string
): Promise<RawTableRecord[]> {
  const records: RawTableRecord[] = []
  let offset: string | undefined
  // Keyed by field ID, so a column rename in Airtable changes nothing here.
  params.set('returnFieldsByFieldId', 'true')

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
    if (!page.records.every(isRawTableRecord)) throwUnexpectedShape()
    records.push(...page.records)
    offset = page.offset
  } while (offset)

  return records
}

async function mapContactIdsToNames(contactsTable: Table, apiToken: string) {
  const primaryFieldId = contactsTable.primaryFieldId
  const params = new URLSearchParams()
  params.set('fields[]', primaryFieldId)
  const contactRecords = await fetchAllRecords(
    CONTACTS_TABLE_ID,
    params,
    apiToken
  )

  return buildContactNameMap(contactRecords, primaryFieldId)
}

async function fetchGranteeRecords(
  publishedFields: GranteeFieldName[],
  apiToken: string
) {
  // view = row filter and sort (Airtable view's filters apply server-side)
  // fields[] = column filter (the published columns, plus the publish flag to filter on)
  const params = new URLSearchParams({ view: VIEW_ID })
  publishedFields.forEach((name) =>
    params.append('fields[]', GRANTEE_FIELDS[name].id)
  )
  params.append('fields[]', PUBLISHED_ON_WEBSITE_FIELD_ID)

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
  // A deleted column fails here by name; a hidden one is only left unpublished.
  for (const { name, id } of READ_FIELDS) {
    findById(projectsTable.fields, id, `"${name}" field`)
  }
  for (const { name, airtableName } of findRenamedFields(
    READ_FIELDS,
    projectsTable.fields
  )) {
    console.warn(
      `⚠️  Field "${name}" is named "${airtableName}" in Airtable — still synced by ID and written as "${name}"`
    )
  }
  // Airtable lists visibleFieldIds for grid views only. Without this check a
  // view of another type reads as one with every column hidden.
  const visibleFieldIds = granteeView.visibleFieldIds
  if (visibleFieldIds === undefined) {
    throw new Error(
      `View '${VIEW_ID}' returned no visibleFieldIds — is it still a grid view?`
    )
  }
  const selection = selectPublishedGranteeFields(visibleFieldIds)
  if (selection instanceof Error) throw selection
  const { published, hidden } = selection
  if (hidden.length > 0) {
    console.log(
      `ℹ️  Read by the site but hidden in the view, so not written: ${hidden.join(', ')}`
    )
  }
  const unrenderedFields = listUnrenderedViewFields(
    visibleFieldIds,
    projectsTable.fields
  )
  if (unrenderedFields.length > 0) {
    console.log(
      `ℹ️  Visible in the view but not read by the site, so not written: ${unrenderedFields.join(', ')}`
    )
  }

  const allGranteeData = await fetchGranteeRecords(published, apiToken)
  const publishedRecords = filterPublishedRecords(
    allGranteeData,
    PUBLISHED_ON_WEBSITE_FIELD_ID
  )
  if (publishedRecords instanceof Error) throw publishedRecords
  const granteeData = publishedRecords.map(toGranteeRecord)
  warnOnMissingProjectNames(granteeData)
  const contactsMap = await mapContactIdsToNames(contactsTable, apiToken)
  const finalGranteeData = resolveProjectLeaders(granteeData, contactsMap)
  // Last, so a column emptied at any step above fails the sync.
  const missingFields = checkGranteeFieldsPresent(finalGranteeData, published)
  if (missingFields instanceof Error) throw missingFields
  await writeAirtableJson(finalGranteeData)
}

importAirtableData().catch((err) => {
  console.error(
    '❌ Error fetching Airtable data:',
    err instanceof Error ? err.message : err
  )
  process.exit(1)
})
