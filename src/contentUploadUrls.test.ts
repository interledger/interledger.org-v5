import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const CONTENT_DIR = path.resolve(__dirname, 'content')

/**
 * An upload linked through the CMS origin rather than the site. CKEditor
 * prefixes the backend URL onto everything it inserts; the CMS strips it on
 * save (`stripUploadOriginsInText`), so a hit here means content reached the
 * repo by some other route. Such a link loads from the firewalled CMS, records
 * whichever CMS the editor used (localhost included), skips the image
 * optimizer and reads as external to the link validator. Protocol-relative
 * `//host/…` and any letter case count too.
 */
const ABSOLUTE_UPLOAD_URL =
  /(?:https?:)?\/\/[^/\s"'()<>]+\/uploads\/img\/original\//i

function listMdxFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => path.join(dir, file))
}

function findAbsoluteUploadUrls(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      ABSOLUTE_UPLOAD_URL.test(line)
        ? [`${path.relative(CONTENT_DIR, file)}:${index + 1}`]
        : []
    )
}

describe('content upload URLs', () => {
  it('finds MDX files to scan', () => {
    expect(listMdxFiles(CONTENT_DIR).length).toBeGreaterThan(0)
  })

  it('links every upload by its site-relative path', () => {
    const offenders = listMdxFiles(CONTENT_DIR).flatMap(findAbsoluteUploadUrls)
    expect(offenders).toEqual([])
  })
})
