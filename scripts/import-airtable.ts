import 'dotenv/config'
import path from 'node:path'
import fs from 'fs/promises'
import * as prettier from 'prettier'
import type { TableMeta, Table, View, TableRecord } from '@/types/airtable'
// Direct path, not the @/utils barrel: the barrel pulls in astro:content chains a tsx script can't load.
import {
  buildContactNameMap,
  filterPublishedRecords,
  isTableRecord,
  resolveProjectLeaders,
  sanitizeRecordFields,
  warnOnMissingProjectNames
} from '../src/utils/main/airtableRecords'

const BASE_ID = 'appP2zUc6VKh79IBD' // Grantee Manager - working
const PROJECTS_TABLE_ID = 'tbliw87UgsAYRAexr' // Projects
const VIEW_ID = 'viwE6kqV1lvcIz2Ms' // Directory Data View April 2026
const CONTACTS_TABLE_ID = 'tbliIEy9J06bTV8Su' // Contacts
const EXCLUDED_FIELD_ID = 'fldirPGzYo96I1Hsu' // Project field in Projects table
const PROJECT_LEADER_FIELD_ID = 'fldKLOR55uQPb5BHG' // Project Leader field in Projects table
const PUBLISHED_ON_WEBSITE_FIELD_ID = 'fldI1myVN2uQs6Lqz' // Published on Website field in Projects table

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
    page.records.forEach(sanitizeRecordFields)
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

  return buildContactNameMap(contactRecords, primaryFieldName)
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
  warnOnMissingProjectNames(granteeData)
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
