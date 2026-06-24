import { getStore } from '@netlify/blobs'
import { buildSnapshot } from '../../src/linear/build-snapshot'
import { purgeRoadmapCache } from './utils/purge-roadmap-cache.mts'

// Scheduled sync: fetch the roadmap from Linear, write it to the blob store, and
// purge the CDN cache. Runs every 12 hours. Errors are logged so a transient
// Linear failure surfaces in the Netlify function logs (and the run is retried)
// without leaving the page broken — it keeps serving the last good blob.
export default async function handler(): Promise<void> {
  try {
    const snapshot = await buildSnapshot()
    const store = getStore('roadmap')
    await store.setJSON('roadmap-snapshot', snapshot)
    await purgeRoadmapCache()
  } catch (err) {
    console.error('[roadmap-sync] failed to sync roadmap from Linear', err)
    throw err
  }
}

export const config = {
  schedule: '0 */12 * * *'
}
