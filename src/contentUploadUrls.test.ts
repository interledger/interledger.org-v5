import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripUploadOriginsInText } from '../cms/src/utils/relativeLinks'

const CONTENT_DIR = path.resolve(__dirname, 'content')

/**
 * An upload linked through the CMS origin rather than the site. CKEditor
 * prefixes the backend URL onto everything it inserts; the CMS strips it on
 * save, so a hit here means content reached the repo by some other route. Such
 * a link loads from the firewalled CMS, records whichever CMS the editor used
 * (localhost included), skips the image optimizer and reads as external to the
 * link validator.
 *
 * The check is the CMS's own strip, so the two can't disagree: a line it would
 * change is an offender, and anything it keeps on purpose (code, URLs nested
 * in other URLs) passes. The strip never adds or removes a line break, so line
 * numbers carry over. The module is pure, which is what makes the import safe.
 */
function listMdxFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => path.join(dir, file))
}

function findAbsoluteUploadUrls(file: string): string[] {
  const lines = readFileSync(file, 'utf8').split('\n')
  const strippedLines = stripUploadOriginsInText(lines.join('\n')).split('\n')
  return lines.flatMap((line, index) =>
    line === strippedLines[index]
      ? []
      : [`${path.relative(CONTENT_DIR, file)}:${index + 1}`]
  )
}

describe('content upload URLs', () => {
  it('flags a line the CMS strip would still change', () => {
    expect(
      stripUploadOriginsInText(
        '[A](https://strapi-admin.interledger.org/uploads/img/original/a.pdf)'
      )
    ).not.toContain('strapi-admin')
  })

  it('finds MDX files to scan', () => {
    expect(listMdxFiles(CONTENT_DIR).length).toBeGreaterThan(0)
  })

  it('links every upload by its site-relative path', () => {
    const offenders = listMdxFiles(CONTENT_DIR).flatMap(findAbsoluteUploadUrls)
    expect(offenders).toEqual([])
  })
})
