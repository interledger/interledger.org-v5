import { appendFile } from 'node:fs/promises'
import path from 'node:path'

// The [[headers]] rules in netlify.toml apply to every deploy context.
// netlify.toml cannot set a header for only the production context.
// Staging builds, branch-deploy builds, and PR preview builds must stay out
// of search results. For this reason, this code adds a noindex rule to the
// _headers file in the publish directory. It adds the rule only when
// CONTEXT is not "production". Netlify merges a _headers file with the
// netlify.toml header rules for the same path. This merge works only when
// the two files do not set the same header key for that path. Here,
// Cache-Control stays in netlify.toml. X-Robots-Tag exists only in this
// file.
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
