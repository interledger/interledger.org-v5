import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z, getCollection: vi.fn().mockResolvedValue([]) }
})

const { ROUTE_BASES } = await import('./utils/main/routes')

const CONTENT_DIR = path.resolve(__dirname, 'content')

// Strapi keeps pathSlug unique per content type only. Two collections on the
// same route base can share a slug, and then one page is silently not built.
const ROOT_COLLECTIONS = Object.entries(ROUTE_BASES)
  .filter(([, base]) => base === '')
  .map(([collection]) => collection)

function frontmatterValue(source: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*['"]?([^'"\\n]+)`, 'm').exec(source)
  return match?.[1].trim()
}

function routeKeys(collection: string): { key: string; file: string }[] {
  const dir = path.join(CONTENT_DIR, collection)
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const source = readFileSync(path.join(dir, file), 'utf8')
      const slug = frontmatterValue(source, 'pathSlug')?.replace(
        /^\/+|\/+$/g,
        ''
      )
      const locale = frontmatterValue(source, 'locale') ?? 'en'
      return { key: `${locale}:${slug}`, file: `${collection}/${file}` }
    })
}

describe('root route collisions', () => {
  it('covers more than one collection', () => {
    expect(ROOT_COLLECTIONS).toEqual(
      expect.arrayContaining(['foundation-pages', 'fundraising-pages'])
    )
  })

  it('has no pathSlug shared by two collections on the root route', () => {
    const filesByKey = new Map<string, string[]>()
    for (const collection of ROOT_COLLECTIONS) {
      for (const { key, file } of routeKeys(collection)) {
        filesByKey.set(key, [...(filesByKey.get(key) ?? []), file])
      }
    }

    const collisions = [...filesByKey.values()].filter(
      (files) => new Set(files.map((file) => file.split('/')[0])).size > 1
    )
    expect(collisions).toEqual([])
  })
})
