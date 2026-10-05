import type { APIRoute } from 'astro'
import rawGranteeData from '@/data/airtable/grantee-data.json'
import {
  getGranteeSearchIndex,
  grantGranteeDirectoryPath,
  localizeRoute
} from '@/utils'

export const GET: APIRoute = () => {
  const index = getGranteeSearchIndex(
    rawGranteeData,
    'es',
    localizeRoute(grantGranteeDirectoryPath(), 'es')
  )
  if (index instanceof Error) throw index
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' }
  })
}
