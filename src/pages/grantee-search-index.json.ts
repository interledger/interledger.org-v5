import type { APIRoute } from 'astro'
import rawGranteeData from '@/data/airtable/grantee-data.json'
import { getGranteeSearchIndex } from '@/utils'

export const GET: APIRoute = () => {
  const index = getGranteeSearchIndex(rawGranteeData, 'en')
  if (index instanceof Error) throw index
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' }
  })
}
