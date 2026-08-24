import { describe, it, expect, vi } from 'vitest'

// `./static-paths` reaches into Astro's virtual modules for the content
// collections and the i18n config. Mock them with a minimal en/es setup so
// this suite runs under plain vitest (see navigation.test.ts for the same
// convention).
vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))

// Two FAQs share the pathSlug `faq` and differ only by section. That pair is
// what makes the section field load-bearing.
const collections: Record<string, { data: Record<string, unknown> }[]> = {
  faqs: [
    { data: { pathSlug: 'faq', section: 'foundation', locale: 'en' } },
    { data: { pathSlug: 'faq', section: 'hackathon', locale: 'en' } }
  ],
  profiles: [],
  reports: []
}

vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return {
    z,
    getCollection: (name: string) => Promise.resolve(collections[name] ?? [])
  }
})

const { getCrossSectionPaths } = await import('./static-paths')

describe('getCrossSectionPaths', () => {
  it('carries the section so a shared pathSlug still resolves', async () => {
    const paths = await getCrossSectionPaths('hackathon', 'en', 'page')

    expect(paths).toHaveLength(1)
    expect(paths[0].props).toMatchObject({
      slug: 'faq',
      kind: 'faq',
      section: 'hackathon'
    })
  })

  it('keeps the foundation FAQ on the foundation section', async () => {
    const paths = await getCrossSectionPaths('foundation', 'en', 'page')

    expect(paths.map((p) => p.props.section)).toEqual(['foundation'])
  })

  it('tags the section on an es path that falls back to en', async () => {
    const paths = await getCrossSectionPaths('hackathon', 'es', 'page')

    expect(paths).toHaveLength(1)
    expect(paths[0].props).toMatchObject({
      slug: 'faq',
      locale: 'en',
      isFallback: true,
      section: 'hackathon'
    })
  })
})
