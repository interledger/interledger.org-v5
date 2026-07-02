import { purgeCache } from '@netlify/functions'

// Purge the CDN-cached roadmap HTML so the next request re-renders with the
// freshly-synced blob. Uses Netlify's built-in function-runtime purge keyed on
// the `roadmap` cache tag (set as `Netlify-Cache-ID` on the page response), so
// it needs no API token.
export async function purgeRoadmapCache(): Promise<void> {
  await purgeCache({ tags: ['roadmap'] })
}
