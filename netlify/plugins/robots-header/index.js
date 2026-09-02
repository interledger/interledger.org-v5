import { readFile, writeFile } from 'node:fs/promises'
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

const NOINDEX_RULE = '/*\n  X-Robots-Tag: noindex, nofollow\n'

// Collapses any trailing newlines to exactly one blank line, so a rule
// appended after this always starts on its own paragraph. Returns empty
// text unchanged, so a fresh file gets no leading blank line.
function withTrailingBlankLine(text) {
  if (text.length === 0) return text
  return text.replace(/\n*$/, '\n\n')
}

export const onPostBuild = async ({ constants }) => {
  if (process.env.CONTEXT === 'production') {
    console.log('[robots-header] production build — leaving pages indexable')
    return
  }

  const headersPath = path.join(constants.PUBLISH_DIR, '_headers')
  const existing = await readFile(headersPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return ''
    throw error
  })

  if (existing.includes(NOINDEX_RULE)) {
    console.log(`[robots-header] noindex rule already present in ${headersPath}`)
    return
  }

  await writeFile(headersPath, withTrailingBlankLine(existing) + NOINDEX_RULE)
  console.log(
    `[robots-header] CONTEXT=${process.env.CONTEXT} — wrote noindex rule to ${headersPath}`
  )
}
