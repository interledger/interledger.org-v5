import { describe, it, expect, vi } from 'vitest'
import type { CollectionEntry } from 'astro:content'

vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z }
})
// The real map awaits buildMap() over every collection at module load.
vi.mock('./translationMapData', () => ({
  translationMap: {
    shared: { en: 'shared', es: 'shared' },
    'en-slug': { en: 'en-slug', es: 'es-slug' },
    'es-slug': { en: 'en-slug', es: 'es-slug' }
  }
}))

const { getBlogPostPath } = await import('./translatePath')

type Entry = CollectionEntry<'foundation-blog'>

function makePost(pathSlug: string, locale: string): Entry {
  return { id: pathSlug, data: { pathSlug, locale } } as unknown as Entry
}

describe('getBlogPostPath', () => {
  it('defaults to the post content locale', () => {
    expect(getBlogPostPath(makePost('shared', 'en'))).toBe('/blog/shared/')
    expect(getBlogPostPath(makePost('shared', 'es'))).toBe('/es/blog/shared/')
  })

  it('links an EN post to its ES fallback route when given the ES locale', () => {
    // Regression for INTORG-1391: related cards on /es/ pages linked to /blog/.
    expect(getBlogPostPath(makePost('shared', 'en'), 'es')).toBe(
      '/es/blog/shared/'
    )
  })

  it('uses the translated slug for the requested locale', () => {
    expect(getBlogPostPath(makePost('en-slug', 'en'), 'es')).toBe(
      '/es/blog/es-slug/'
    )
  })
})
