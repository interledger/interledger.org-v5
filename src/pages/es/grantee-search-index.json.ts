import type { APIRoute } from 'astro'
import { granteeDirectorySources } from '@/data/airtable/granteeDirectorySources'
import {
  getGranteeSearchIndex,
  grantGranteeDirectoryPath,
  localizeRoute
} from '@/utils'

export const GET: APIRoute = () => {
  const index = getGranteeSearchIndex(
    granteeDirectorySources(),
    'es',
    localizeRoute(grantGranteeDirectoryPath(), 'es')
  )
  if (index instanceof Error) throw index
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' }
  })
}
