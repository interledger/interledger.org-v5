/**
 * An invalid MDX file is skipped and its Strapi entry left as it is. Orphans
 * are found by the stored pathSlug, so when the invalid value is the pathSlug
 * itself, nothing matched the entry and the sync deleted it (PR #881 review).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContentTypes, FrontmatterSchema } from './config'
import type { SyncContext } from './types'
import { createFakeStrapi, createMdxFile } from './test-utils'

const scanned = vi.hoisted(() => ({ files: [] as unknown[] }))

vi.mock('./scan', () => ({
  scanMDXFiles: vi.fn(() => scanned.files),
  getLocalesToCheck: vi.fn(() => ['en'])
}))

import { syncContentType } from './syncCoordinator'

const KEBAB_PATH = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/

/** Rejects a malformed pathSlug or a missing title, like the real schemas. */
const pageSchema: FrontmatterSchema = {
  parse: (data) => data,
  safeParse(data) {
    const { pathSlug, title } = data as { pathSlug: string; title?: string }
    const issues = [
      ...(KEBAB_PATH.test(pathSlug)
        ? []
        : [{ path: ['pathSlug'], message: 'invalid pathSlug' }]),
      ...(title ? [] : [{ path: ['title'], message: 'Required' }])
    ]
    return issues.length > 0
      ? { success: false, error: { issues } }
      : { success: true }
  }
}

function pageContentTypes(): ContentTypes {
  return {
    pages: {
      dir: '/content/pages',
      apiId: 'pages',
      schema: pageSchema,
      buildPayload: vi.fn(async (mdx) => ({
        title: mdx.frontmatter.title,
        pathSlug: mdx.pathSlug
      }))
    }
  } as unknown as ContentTypes
}

function page(pathSlug: string, title?: string) {
  return createMdxFile({
    file: `${pathSlug}.mdx`,
    filepath: `/content/pages/${pathSlug}.mdx`,
    pathSlug,
    frontmatter: { title }
  })
}

/** Syncs `about-us` and `contact` once, so Strapi holds both entries. */
async function syncedSite() {
  const fake = createFakeStrapi()
  const ctx: SyncContext = {
    contentTypes: pageContentTypes(),
    strapi: fake.strapi
  }
  scanned.files = [page('about-us', 'About'), page('contact', 'Contact')]
  await syncContentType('pages', ctx, false)
  vi.clearAllMocks()
  return { ...fake, ctx }
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sync with an invalid MDX file', () => {
  it.each([
    ['its pathSlug is malformed', page('About Us!', 'About')],
    ['a required field is missing', page('about-us')]
  ])('keeps the entry when %s', async (_situation, invalidFile) => {
    const { strapi, entries, ctx } = await syncedSite()
    scanned.files = [invalidFile, page('contact', 'Contact')]

    const results = await syncContentType('pages', ctx, false)

    expect(results.errors).toBe(1)
    expect(results.deleted).toBe(0)
    expect(strapi.deleteEntry).not.toHaveBeenCalled()
    const about = entries.find((e) => e.pathSlug === 'about-us')
    expect(about?.title).toBe('About')
  })

  // The cost of the rule: a page removed in the same run is deleted on the
  // first sync after the invalid file is fixed, not now.
  it('defers deleting a removed page until every file is valid', async () => {
    const { strapi, entries, ctx } = await syncedSite()
    scanned.files = [page('About Us!', 'About')]

    await syncContentType('pages', ctx, false)
    expect(strapi.deleteEntry).not.toHaveBeenCalled()

    scanned.files = [page('about-us', 'About')]
    const results = await syncContentType('pages', ctx, false)

    expect(results.deleted).toBe(1)
    expect(entries.map((e) => e.pathSlug)).toEqual(['about-us'])
  })
})
