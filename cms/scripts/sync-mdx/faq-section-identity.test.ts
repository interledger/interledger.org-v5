/**
 * Regression test for INTORG-1132.
 *
 * The foundation FAQ (`src/content/faqs/faq.mdx`, section: foundation) and the
 * hackathon FAQ (`src/content/faqs/hackathon-faq.mdx`, section: hackathon)
 * both carry `pathSlug: 'faq'`, because pathSlug is relative to the section.
 * The sync used to look entries up by pathSlug alone, so the second file found
 * the first file's entry and updated it. Three MDX files produced two Strapi
 * entries, and the staging log showed `Updated: faq (en)` twice.
 *
 * This drives the real syncContentType against an in-memory Strapi whose
 * findByPathSlug honors the section filter, the way the live API does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContentTypes } from './config'
import type { StrapiClient, StrapiEntry } from './strapiClient'
import type { SyncContext } from './types'
import { createMdxFile } from './test-utils'

const scanned = vi.hoisted(() => ({ files: [] as unknown[] }))

vi.mock('./scan', () => ({
  scanMDXFiles: vi.fn(() => scanned.files),
  getLocalesToCheck: vi.fn(() => ['en'])
}))

import { syncContentType } from './syncCoordinator'

/**
 * Minimal in-memory stand-in for the Strapi content API. Only the calls the
 * FAQ sync makes are implemented; everything else throws so a new dependency
 * shows up as a failure rather than a silent undefined.
 */
function createFakeStrapi() {
  const entries: Array<StrapiEntry & { locale: string }> = []
  let nextId = 1

  const unsupported = (name: string) => () => {
    throw new Error(`${name} is not expected in this test`)
  }

  const strapi = {
    request: unsupported('request'),
    findUploadByUrl: unsupported('findUploadByUrl'),
    findUploadByName: unsupported('findUploadByName'),
    updateUploadAlt: unsupported('updateUploadAlt'),
    createLocalization: unsupported('createLocalization'),
    updateLocalization: unsupported('updateLocalization'),

    getAllEntries: vi.fn(async (_apiId: string, locale = 'all') =>
      locale === 'all'
        ? [...entries]
        : entries.filter((e) => e.locale === locale)
    ),

    findByPathSlug: vi.fn(
      async (
        _apiId: string,
        pathSlug: string,
        locale?: string,
        section?: string | null
      ) =>
        entries.find(
          (e) =>
            e.pathSlug === pathSlug &&
            (!locale || e.locale === locale) &&
            (!section || e.section === section)
        )
    ),

    createEntry: vi.fn(
      async (_apiId: string, data: Record<string, unknown>) => {
        const entry = {
          documentId: `doc-${nextId++}`,
          pathSlug: data.pathSlug as string,
          section: data.section as string | undefined,
          locale: 'en',
          title: data.title
        }
        entries.push(entry)
        return { data: entry }
      }
    ),

    updateEntry: vi.fn(
      async (
        _apiId: string,
        documentId: string,
        data: Record<string, unknown>
      ) => {
        const entry = entries.find((e) => e.documentId === documentId)!
        Object.assign(entry, data)
        return { data: entry }
      }
    ),

    deleteEntry: vi.fn(async (_apiId: string, documentId: string) => {
      const i = entries.findIndex((e) => e.documentId === documentId)
      if (i >= 0) entries.splice(i, 1)
      return {}
    }),

    deleteLocalization: vi.fn(
      async (_apiId: string, documentId: string, locale: string) => {
        const i = entries.findIndex(
          (e) => e.documentId === documentId && e.locale === locale
        )
        if (i >= 0) entries.splice(i, 1)
        return {}
      }
    )
  }

  return { strapi: strapi as unknown as StrapiClient, entries }
}

/** The three real FAQ files, in the alphabetical order the scanner returns. */
function realFaqFiles() {
  return [
    createMdxFile({
      file: 'faq.mdx',
      filepath: '/content/faqs/faq.mdx',
      pathSlug: 'faq',
      section: 'foundation',
      frontmatter: { title: 'Frequently Asked Questions' }
    }),
    createMdxFile({
      file: 'grant-grantmaking-faq.mdx',
      filepath: '/content/faqs/grant-grantmaking-faq.mdx',
      pathSlug: 'grant/grantmaking-faq',
      section: 'foundation',
      frontmatter: { title: 'Grantmaking FAQ' }
    }),
    createMdxFile({
      file: 'hackathon-faq.mdx',
      filepath: '/content/faqs/hackathon-faq.mdx',
      pathSlug: 'faq',
      section: 'hackathon',
      frontmatter: { title: 'FAQ' }
    })
  ]
}

function faqContentTypes(sectionScopedIdentity: boolean): ContentTypes {
  const buildPayload = vi.fn(async (mdx) => ({
    title: mdx.frontmatter.title,
    pathSlug: mdx.pathSlug,
    section: mdx.section
  }))
  return {
    faqs: {
      dir: '/content/faqs',
      apiId: 'faqs',
      sectionScopedIdentity,
      buildPayload
    },
    profiles: {
      dir: '/content/profiles',
      apiId: 'profile-pages',
      sectionScopedIdentity,
      buildPayload
    }
  } as unknown as ContentTypes
}

/**
 * A hackathon speaker and a foundation fellow under one pathSlug. Profiles
 * carry the same section-relative pathSlug as faqs, so they need the same
 * treatment even though nothing collides in the repo today.
 */
function collidingProfiles() {
  return [
    createMdxFile({
      file: 'speakers-jane-doe.mdx',
      filepath: '/content/profiles/speakers-jane-doe.mdx',
      pathSlug: 'speakers/jane-doe',
      section: 'foundation',
      frontmatter: { title: 'Jane Doe, fellow' }
    }),
    createMdxFile({
      file: 'hackathon-speakers-jane-doe.mdx',
      filepath: '/content/profiles/hackathon-speakers-jane-doe.mdx',
      pathSlug: 'speakers/jane-doe',
      section: 'hackathon',
      frontmatter: { title: 'Jane Doe, speaker' }
    })
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  scanned.files = realFaqFiles()
})

describe('faq sync with section-scoped identity', () => {
  it('creates one Strapi entry per MDX file', async () => {
    const { strapi, entries } = createFakeStrapi()
    const ctx: SyncContext = { contentTypes: faqContentTypes(true), strapi }

    const results = await syncContentType('faqs', ctx, false)

    expect(results.errors).toBe(0)
    expect(results.created).toBe(3)
    expect(entries).toHaveLength(3)
    expect(entries.map((e) => `${e.section}:${e.pathSlug}`).sort()).toEqual([
      'foundation:faq',
      'foundation:grant/grantmaking-faq',
      'hackathon:faq'
    ])
  })

  it('keeps the foundation FAQ title instead of overwriting it with the hackathon one', async () => {
    const { strapi, entries } = createFakeStrapi()
    const ctx: SyncContext = { contentTypes: faqContentTypes(true), strapi }

    await syncContentType('faqs', ctx, false)

    const foundation = entries.find(
      (e) => e.section === 'foundation' && e.pathSlug === 'faq'
    )
    expect(foundation?.title).toBe('Frequently Asked Questions')
  })

  it('updates each entry in place on a second run, creating nothing new', async () => {
    const { strapi, entries } = createFakeStrapi()
    const ctx: SyncContext = { contentTypes: faqContentTypes(true), strapi }

    await syncContentType('faqs', ctx, false)
    scanned.files = realFaqFiles()
    const second = await syncContentType('faqs', ctx, false)

    expect(second.created).toBe(0)
    expect(second.updated).toBe(3)
    expect(second.deleted).toBe(0)
    expect(entries).toHaveLength(3)
  })

  it('does not treat a section sibling as an orphan', async () => {
    const { strapi, entries } = createFakeStrapi()
    const ctx: SyncContext = { contentTypes: faqContentTypes(true), strapi }

    await syncContentType('faqs', ctx, false)
    scanned.files = realFaqFiles()
    const second = await syncContentType('faqs', ctx, false)

    expect(second.deleted).toBe(0)
    expect(strapi.deleteEntry).not.toHaveBeenCalled()
    expect(entries).toHaveLength(3)
  })

  it('keeps two profiles that share a pathSlug across sections apart', async () => {
    const { strapi, entries } = createFakeStrapi()
    const ctx: SyncContext = { contentTypes: faqContentTypes(true), strapi }
    scanned.files = collidingProfiles()

    const results = await syncContentType('profiles', ctx, false)

    expect(results.errors).toBe(0)
    expect(results.created).toBe(2)
    expect(entries.map((e) => e.title).sort()).toEqual([
      'Jane Doe, fellow',
      'Jane Doe, speaker'
    ])
  })

  // The pre-fix behavior, kept as a guard: without section in the identity the
  // two `faq` files still collapse, so the collision guard must catch them
  // rather than let one silently overwrite the other.
  it('rejects the duplicate instead of overwriting when identity ignores section', async () => {
    const { strapi, entries } = createFakeStrapi()
    const ctx: SyncContext = { contentTypes: faqContentTypes(false), strapi }

    const results = await syncContentType('faqs', ctx, false)

    expect(results.errors).toBe(1)
    expect(entries).toHaveLength(2)
  })
})
