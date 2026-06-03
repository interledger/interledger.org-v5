import { buildFoundationBlogSearchIndex } from '@/utils/main/buildFoundationBlogSearchIndex'

export async function GET() {
  const index = await buildFoundationBlogSearchIndex('es')
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  })
}
