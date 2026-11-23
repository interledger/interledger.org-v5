import type { APIRoute } from 'astro'
import { granteeDirectorySources } from '@/data/airtable/granteeDirectorySources'
import { getGranteeSearchIndex } from '@/utils'

export const GET: APIRoute = () => {
  const index = getGranteeSearchIndex(granteeDirectorySources(), 'es')
  if (index instanceof Error) throw index
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' }
  })
}
