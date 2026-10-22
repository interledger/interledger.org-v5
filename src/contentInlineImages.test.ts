import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const CONTENT_DIR = path.resolve(__dirname, 'content')

/**
 * An image stored inline as a `data:` URI instead of a file. It puts the whole
 * image into the MDX, and it skips the media library, the image optimizer and
 * the CDN. The CMS editor uploads pasted images, so a hit here means an image
 * reached the repo by a route that skipped the upload.
 */
const INLINE_IMAGE = /(?:\]\(|\bsrc=["']?)\s*data:image\//i

function listMdxFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => path.join(dir, file))
}

function findInlineImages(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      INLINE_IMAGE.test(line)
        ? [`${path.relative(CONTENT_DIR, file)}:${index + 1}`]
        : []
    )
}

describe('content inline images', () => {
  it('matches markdown and HTML data: images, not uploads', () => {
    expect(INLINE_IMAGE.test('![](data:image/png;base64,iVBO)')).toBe(true)
    expect(INLINE_IMAGE.test('<img src="data:image/png;base64,iVBO">')).toBe(
      true
    )
    expect(INLINE_IMAGE.test('![A](/uploads/img/original/a.png)')).toBe(false)
  })

  it('finds MDX files to scan', () => {
    expect(listMdxFiles(CONTENT_DIR).length).toBeGreaterThan(0)
  })

  it('stores every image as a file, not a data: URI', () => {
    const offenders = listMdxFiles(CONTENT_DIR).flatMap(findInlineImages)
    expect(offenders).toEqual([])
  })
})
