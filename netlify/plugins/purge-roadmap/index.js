import { purgeCache } from '@netlify/functions'

// The roadmap page is durable-cached at the CDN (see netlify.toml headers and
// the README's "CDN caching" section). Durable Cache survives deploys, and the
// only other purge trigger is a data sync — so a code/CSS-only change would keep
// serving stale HTML until the cache expires. This invalidates the `roadmap`
// tag on every successful deploy so code changes show up immediately. Scoped to
// the deploy context (preview purges preview, prod purges prod) via the token,
// since the build runtime doesn't always auto-inject one.
export const onSuccess = async () => {
  const token = process.env.NETLIFY_API_TOKEN

  if (!token) {
    console.warn(
      '[purge-roadmap] NETLIFY_API_TOKEN not set — skipping roadmap CDN cache purge',
    )
    return
  }

  await purgeCache({ tags: ['roadmap'], token })
  console.log('[purge-roadmap] purged roadmap CDN cache after deploy')
}
