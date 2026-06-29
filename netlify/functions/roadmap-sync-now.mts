import { timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { buildSnapshot } from '../../src/linear/build-snapshot'
import { purgeRoadmapCache } from './utils/purge-roadmap-cache.mts'

// Read directly here (not from the shared env module) so the scheduled sync,
// which never uses it, doesn't fail at cold start when it is unset.
const API_SECRET = process.env.API_SECRET ?? ''
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
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { Allow: 'POST', 'Content-Type': 'application/json' }
    })
  }

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

  // Throttle on the last SUCCESSFUL sync. The read-then-write is not atomic, so
  // two near-simultaneous calls could both pass — acceptable for a secret-gated
  // manual endpoint.
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

  try {
    const snapshot = await buildSnapshot()
    await store.setJSON('roadmap-snapshot', snapshot)
    await purgeRoadmapCache()
    // Only burn the rate-limit window after a successful sync, so a failed run
    // (502 below) can be retried immediately.
    await store.setJSON(RL_KEY, { ts: Date.now() })
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

// Static object literal: Netlify extracts function config by static analysis, so
// a computed/ternary value here would not register the path (the route would
// 404). This path works in both `netlify dev` and production.
export const config = { path: '/api/roadmap-sync' }
