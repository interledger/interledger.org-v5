import { timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { buildSnapshot } from '../../src/linear/build-snapshot'
import { API_SECRET, isNetlifyDev } from '../../src/linear/env'
import { purgeRoadmapCache } from './utils/purge-roadmap-cache.mts'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const RL_KEY = 'sync-rate-limit'

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  })
}

// Manual sync trigger: POST /api/roadmap-sync with `Authorization: Bearer <API_SECRET>`.
// Rate-limited to once per 5 minutes via the blob store.
export default async function handler(
  req: Request,
  _ctx: Context
): Promise<Response> {
  const token = (req.headers.get('authorization') ?? '').replace(
    /^Bearer\s+/i,
    ''
  )

  if (!API_SECRET) return unauthorized()

  const secretBuf = Buffer.from(API_SECRET)
  const tokenBuf = Buffer.from(token)
  const authorized =
    tokenBuf.length === secretBuf.length && timingSafeEqual(tokenBuf, secretBuf)
  if (!authorized) return unauthorized()

  const store = getStore('roadmap')

  const lastSync = (await store.get(RL_KEY, { type: 'json' })) as {
    ts: number
  } | null
  if (lastSync && Date.now() - lastSync.ts < FIVE_MINUTES_MS) {
    const retryAfter = Math.ceil(
      (FIVE_MINUTES_MS - (Date.now() - lastSync.ts)) / 1000
    )
    return new Response(
      JSON.stringify({ error: 'Too Many Requests', retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter)
        }
      }
    )
  }
  await store.setJSON(RL_KEY, { ts: Date.now() })

  try {
    const snapshot = await buildSnapshot()
    await store.setJSON('roadmap-snapshot', snapshot)
    await purgeRoadmapCache()
    return new Response(
      JSON.stringify({ ok: true, generatedAt: snapshot.generatedAt }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[roadmap-sync-now] sync failed', err)
    return new Response(JSON.stringify({ error: 'Sync failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// In local dev (`netlify dev`), the [[context.dev.redirects]] rule in netlify.toml
// maps /api/roadmap-sync to this function. Self-registering a path here as well
// conflicts with that redirect, so set the path only outside dev.
export const config = isNetlifyDev ? {} : { path: '/api/roadmap-sync' }
