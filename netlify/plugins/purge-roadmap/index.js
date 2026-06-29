import { purgeCache } from '@netlify/functions'

// The roadmap page is durable-cached at the CDN (see netlify.toml headers and
// the README's "CDN caching" section). Durable Cache survives deploys, and the
// only other purge trigger is a data sync — so a code/CSS-only change would keep
// serving stale HTML until the cache expires. This invalidates the `roadmap`
// tag on every successful deploy so code changes show up immediately. Scoped to
// the deploy context (preview purges preview, prod purges prod) and auto-
// authenticated in the build runtime, so it needs no token.
export const onSuccess = async () => {
  await purgeCache({ tags: ['roadmap'] })
  console.log('[purge-roadmap] purged roadmap CDN cache after deploy')
}
