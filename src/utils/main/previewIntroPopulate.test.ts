import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGES_DIR = path.resolve(import.meta.dirname, '../../pages')
const CMS_SRC_DIR = path.resolve(import.meta.dirname, '../../../cms/src')
const CMS_BLOCKS_DIR = path.join(CMS_SRC_DIR, 'components/blocks')

/**
 * Draft-preview routes that fetch a dynamic zone straight from Strapi, and
 * the content types each one can preview.
 */
const PREVIEW_ROUTES: Readonly<Record<string, readonly string[]>> = {
  'page-preview.astro': ['foundation-page', 'fundraising-page'],
  'preview/page-preview.astro': ['foundation-page', 'fundraising-page'],
  'preview/hackathon-preview.astro': ['hackathon-page']
}

function readJson(file: string): { attributes?: Record<string, unknown> } {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** `blocks.*` uids whose Strapi schema has an `intro` field. */
function introBlockUids(): Set<string> {
  return new Set(
    readdirSync(CMS_BLOCKS_DIR)
      .filter((file) => file.endsWith('.json'))
      .filter(
        (file) =>
          'intro' in
          (readJson(path.join(CMS_BLOCKS_DIR, file)).attributes ?? {})
      )
      .map((file) => `blocks.${path.basename(file, '.json')}`)
  )
}

/** Components a content type's `content` dynamic zone allows. */
function allowedBlocks(contentType: string): string[] {
  const schema = readJson(
    path.join(
      CMS_SRC_DIR,
      'api',
      contentType,
      'content-types',
      contentType,
      'schema.json'
    )
  )
  const content = schema.attributes?.content as { components?: string[] }
  return content?.components ?? []
}

function populatesIntro(source: string, uid: string): boolean {
  return (
    source.includes(`'populate[content][on][${uid}][populate][intro]'`) ||
    source.includes(`'populate[content][on][${uid}][populate]': '*'`)
  )
}

describe('preview routes', () => {
  const introBlocks = introBlockUids()

  it('finds the blocks that have an intro', () => {
    expect(introBlocks).toContain('blocks.card-grid')
  })

  it.each(Object.entries(PREVIEW_ROUTES))(
    '%s populates the intro of every intro block it can preview',
    (route, contentTypes) => {
      // Strapi only returns a nested component that the query names, so a
      // block left out here previews without its heading or top spacing.
      // `[populate]: '*'` names every first-level component.
      const source = readFileSync(path.join(PAGES_DIR, route), 'utf8')
      const expected = [...new Set(contentTypes.flatMap(allowedBlocks))].filter(
        (uid) => introBlocks.has(uid)
      )
      const missing = expected.filter((uid) => !populatesIntro(source, uid))

      expect(expected.length).toBeGreaterThan(0)
      expect(missing).toEqual([])
    }
  )
})
