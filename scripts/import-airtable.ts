import 'dotenv/config'
import path from 'node:path'
import fs from 'fs/promises'
import type { TableMeta, Table, View, TableRecord } from '@/types/airtable'

const BASE_ID = 'appP2zUc6VKh79IBD' // Grantee Manager - working
const PROJECTS_TABLE_ID = 'tbliw87UgsAYRAexr' // Projects
const VIEW_ID = 'viwE6kqV1lvcIz2Ms' // Directory Data View April 2026
const CONTACTS_TABLE_ID = 'tbliIEy9J06bTV8Su' // Contacts

function getStringField(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${context} to be a string, got ${typeof value}`)
  }
  return value
}

function isTableRecord(value: unknown): value is TableRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.createdTime !== 'string')
    return false
  if (typeof v.fields !== 'object' || v.fields === null) return false
  const fields = v.fields as Record<string, unknown>
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

  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  console.log(`✅ Saved Airtable data JSON: ${filePath}`)
}

async function mapContactIdsToNames(contactsTable: Table, apiToken: string) {
  const primaryFieldId = contactsTable.primaryFieldId
  const primaryFieldName = contactsTable.fields.find(
    (f) => f.id === primaryFieldId
  )?.name

  if (!primaryFieldName)
    throw new Error(
      `❌ Primary field with ID ${primaryFieldId} not found in Contacts table metadata`
    )
  const contactRecords: TableRecord[] = []
  const params = new URLSearchParams()
  params.set('fields[]', primaryFieldId)
  let offset: string | undefined = undefined

  do {
    if (offset) {
      params.set('offset', offset)
    }
    const url = `https://api.airtable.com/v0/${BASE_ID}/${CONTACTS_TABLE_ID}?${params}`
    const result = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    })

    if (!result.ok) {
      throw new Error(
        `❌ Failed to fetch Airtable data; Status: ${result.status} ${result.statusText}`
      )
    }

    const page = await result.json()
    if (!Array.isArray(page.records) || !page.records.every(isTableRecord)) {
      throw new Error(
        `Unexpected response shape from Airtable: page.records is not TableRecord[]`
      )
    }
    contactRecords.push(...page.records)
    offset = page.offset
  } while (offset)

  const contactMap = new Map<string, string>(
    contactRecords.map((record: TableRecord) => [
      record.id,
      getStringField(
        record.fields[primaryFieldName],
        `Contact record ${record.id} primary field value`
      )
    ])
  )

  return contactMap
}

async function fetchGranteeRecords(view: View, apiToken: string) {
  // view = row filter (Airtable view's filters apply server-side)
  // fields[] = column filter (only return the view's visible fields)
  // exclude Project field (id: fldirPGzYo96I1Hsu)
  const excludedFieldId = 'fldirPGzYo96I1Hsu'
  const params = new URLSearchParams({
    view: VIEW_ID
  })
  view.visibleFieldIds?.forEach(
    (id) => id !== excludedFieldId && params.append('fields[]', id)
  )

  const records: TableRecord[] = []
  let offset: string | undefined = undefined

  do {
    if (offset) {
      params.set('offset', offset)
    }

    const granteeRecordsUrl = `https://api.airtable.com/v0/${BASE_ID}/${PROJECTS_TABLE_ID}?${params}`
    const result = await fetch(granteeRecordsUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    })

    if (!result.ok) {
      throw new Error(
        `❌ Failed to fetch Airtable data; Status: ${result.status} ${result.statusText}`
      )
    }

    const page = await result.json()
    if (!Array.isArray(page.records) || !page.records.every(isTableRecord)) {
      throw new Error(
        `Unexpected response shape from Airtable: page.records is not TableRecord[]`
      )
    }
    records.push(...page.records)
    offset = page.offset
  } while (offset)
  return records
}

async function fetchAirtableData() {
  const apiToken = process.env.AIRTABLE_API_TOKEN
  if (!apiToken) {
    throw new Error(
      '❌ Missing Airtable configuration. Please set AIRTABLE_API_TOKEN in your environment variables.'
    )
  }

  const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables?include=visibleFieldIds`
  const meta: TableMeta = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` }
  }).then((r) => r.json())

  const contactsTable = meta.tables.find((t) => t.id === CONTACTS_TABLE_ID)
  if (!contactsTable) {
    throw new Error(
      `❌ Contacts table with ID ${CONTACTS_TABLE_ID} not found in Airtable base metadata.`
    )
  }
  const projectsTable = meta.tables.find((t) => t.id === PROJECTS_TABLE_ID)
  const view = projectsTable?.views.find((v) => v.id === VIEW_ID)

  if (!view?.visibleFieldIds?.length) {
    throw new Error(`❌ View ${VIEW_ID} not found or has no visible fields`)
  }

  const granteeData: TableRecord[] = await fetchGranteeRecords(view, apiToken)
  // granteeData contains the IDs of Project Leaders, we are swaping that with the actual names from the Contacts table before writing the JSON file
  const contactsMap = await mapContactIdsToNames(contactsTable, apiToken)
  granteeData.forEach((record) => {
    const leaderIds = record.fields['Project Leader']
    if (leaderIds === undefined) return
    if (!Array.isArray(leaderIds)) {
      throw new Error(
        `❌ Unexpected format for Project Leader field in record ${record.id}: expected string[]`
      )
    }

    record.fields['Project Leader'] = leaderIds.map(
      (id) => contactsMap.get(id) || 'Unknown'
    )
  })
  await writeAirtableJson(granteeData)
}

fetchAirtableData().catch((err) => {
  console.error(
    '❌ Error fetching Airtable data:',
    err instanceof Error ? err.message : err
  )
  process.exit(1)
})
