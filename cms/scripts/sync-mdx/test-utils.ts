import { vi } from 'vitest'
import type { MDXFile } from './mdxTypes'
import type { StrapiClient, StrapiEntry } from './strapiClient'

// Allow undefined values to test edge cases without casts
type MdxFileOverrides = Partial<{
  [K in keyof MDXFile]: MDXFile[K] | undefined
}>

export function createMdxFile(overrides: MdxFileOverrides = {}): MDXFile {
  return {
    file: 'test.mdx',
    filepath: '/content/test.mdx',
    pathSlug: 'test',
    section: null,
    locale: 'en',
    frontmatter: {},
    content: '',
    isLocalization: false,
    localizes: null,
    ...overrides
  } as MDXFile
}

/**
 * Minimal in-memory stand-in for the Strapi content API. Only the calls
 * syncContentType makes for a single-locale type are implemented; everything else throws so a new dependency
 * shows up as a failure rather than a silent undefined.
 */
export function createFakeStrapi() {
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
