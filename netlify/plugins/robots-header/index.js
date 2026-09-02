import { appendFile } from 'node:fs/promises'
import path from 'node:path'

// netlify.toml [[headers]] rules apply to every deploy context alike — there
// is no way to scope a header to production only from inside netlify.toml.
// Staging, branch deploys, and PR deploy previews must stay out of search
// results, so this appends a noindex rule to the publish dir's _headers file
// only when CONTEXT isn't "production". Netlify merges a _headers file with
// netlify.toml headers for the same path as long as they don't set the same
// key — Cache-Control stays in netlify.toml, X-Robots-Tag lives only here.
export const onPostBuild = async ({ constants }) => {
  if (process.env.CONTEXT === 'production') {
    console.log('[robots-header] production build — leaving pages indexable')
    return
  }

  const headersPath = path.join(constants.PUBLISH_DIR, '_headers')
  await appendFile(headersPath, '\n/*\n  X-Robots-Tag: noindex, nofollow\n')
  console.log(
    `[robots-header] CONTEXT=${process.env.CONTEXT} — wrote noindex rule to ${headersPath}`
  )
}
