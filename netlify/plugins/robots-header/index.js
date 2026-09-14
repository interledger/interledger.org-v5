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

const NOINDEX_PATH = '/*'
const NOINDEX_HEADER = 'X-Robots-Tag: noindex, nofollow'

// The rule ends with a blank line. A later step can then append another
// rule, and the file stays correct.
const NOINDEX_RULE = `${NOINDEX_PATH}\n  ${NOINDEX_HEADER}\n\n`

// Collapses any trailing newlines to exactly one blank line, so a rule
// appended after this always starts on its own paragraph. Returns empty
// text unchanged, so a fresh file gets no leading blank line.
function withTrailingBlankLine(text) {
  if (text.length === 0) return text
  return text.replace(/\n*$/, '\n\n')
}

// Reports whether the _headers text sets the given header for the given
// path. A _headers file holds blocks. Each block starts with a path line
// that has no indent. The indented lines after it give the headers for that
// path. This function reads the text as blocks. So the result does not
// change with the order of the headers, or with the other headers in the
// same block. A plain text search is not sufficient: the path "/preview/*"
// also ends with the characters "/*".
function hasHeaderForPath(text, targetPath, targetHeader) {
  const wanted = targetHeader.toLowerCase()
  let inTargetBlock = false

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue

    const startsNewBlock = !/^\s/.test(line)
    if (startsNewBlock) {
      inTargetBlock = trimmed === targetPath
      continue
    }

    if (inTargetBlock && trimmed.toLowerCase() === wanted) return true
  }

  return false
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

  if (hasHeaderForPath(existing, NOINDEX_PATH, NOINDEX_HEADER)) {
    console.log(
      `[robots-header] noindex rule already present in ${headersPath}`
    )
    return
  }

  await writeFile(headersPath, withTrailingBlankLine(existing) + NOINDEX_RULE)
  console.log(
    `[robots-header] CONTEXT=${process.env.CONTEXT} — wrote noindex rule to ${headersPath}`
  )
}
