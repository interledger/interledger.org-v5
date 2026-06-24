import { NETLIFY_SITE_ID, NETLIFY_API_TOKEN } from '../../../src/linear/env'

// Purge the CDN-cached /developers/roadmap HTML so the next request re-renders
// with the freshly-synced blob. No-op when the optional Netlify token is unset.
export async function purgeRoadmapCache(): Promise<void> {
  if (!NETLIFY_SITE_ID || !NETLIFY_API_TOKEN) return

  await fetch('https://api.netlify.com/api/v1/purge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NETLIFY_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      site_id: NETLIFY_SITE_ID,
      paths: ['/developers/roadmap']
    })
  })
}
