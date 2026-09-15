import type { APIRoute } from 'astro'
import { getBlogSearchIndex } from '@/utils'

export const GET: APIRoute = async () => {
  const index = await getBlogSearchIndex()
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' }
  })
}
