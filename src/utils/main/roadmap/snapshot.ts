import { getStore } from '@netlify/blobs'
import type { Snapshot } from '@/types/roadmap'
import { tryCatchAsync } from '../../shared/tryCatch'
import { loadDevSnapshot } from './devSnapshot'

// SSR (INTORG-737): read the roadmap snapshot from Netlify Blobs at request
// time. The scheduled sync function (netlify/functions/roadmap-sync)
// populates the store from Linear. Shared by /tech/roadmap and its ES
// fallback route so both serve the same data without duplicating the fetch.
export async function getRoadmapSnapshot(): Promise<Snapshot | null> {
  const result = await tryCatchAsync(async () => {
    const store = getStore('roadmap')
    return (await store.get('roadmap-snapshot', {
      type: 'json'
    })) as Snapshot | null
  })

  // Local dev: the blob is usually empty (no scheduled sync has run), so source
  // the data here instead of making a dev hit the manual /api/roadmap-sync
  // endpoint. With LINEAR_API_KEY set we fetch Linear directly; otherwise we
  // render the bundled fixture so the page works with zero setup. In
  // production a missing/failed blob renders the empty state rather than
  // placeholder data.
  if (result instanceof Error || !result) {
    return import.meta.env.DEV ? loadDevSnapshot() : null
  }

  return result
}
