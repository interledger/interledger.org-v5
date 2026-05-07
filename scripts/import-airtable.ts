import 'dotenv/config'
import path from 'node:path'
import fs from 'fs/promises'

const BASE_ID = 'appP2zUc6VKh79IBD' // Grantee Manager - working
const TABLE_ID = 'tbliw87UgsAYRAexr' // Projects
const VIEW_ID = 'viwE6kqV1lvcIz2Ms' // Directory Data View April 2026

async function writeAirtableJson(data: any) {
  const basePath = path.resolve('./src/data/airtable')
  await fs.mkdir(basePath, { recursive: true })
  const filePath = path.join(basePath, 'grantee-data.json')

  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  console.log(`✅ Saved Airtable data JSON: ${filePath}`)
}

async function fetchGranteeRecords(view: any, apiToken: string) {
  // view = row filter (Airtable view's filters apply server-side)
  // fields[] = column filter (only return the view's visible fields)
  const params = new URLSearchParams({
    view: VIEW_ID
  })
  view.visibleFieldIds.forEach((id: string) => params.append('fields[]', id))

  const records = []
  let offset: string | undefined = undefined

  do {
    if (offset) {
      params.set('offset', offset)
    }

    const granteeRecordsUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params}`
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
  const meta = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` }
  }).then((r) => r.json())

  const table = meta.tables.find((t: any) => t.id === TABLE_ID)
  const view = table?.views.find((v: any) => v.id === VIEW_ID)

  if (!view?.visibleFieldIds?.length) {
    throw new Error(`❌ View ${VIEW_ID} not found or has no visible fields`)
  }

  const granteeData = await fetchGranteeRecords(view, apiToken)
  await writeAirtableJson(granteeData)
}

fetchAirtableData().catch((err) => {
  console.error(
    '❌ Error fetching Airtable data:',
    err instanceof Error ? err.message : err
  )
  process.exit(1)
})
