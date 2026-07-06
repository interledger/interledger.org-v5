import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultLang,
  generateMDX,
  readLocaleFromUpdateEvent,
  resolvePageFilepath
} from '@/utils'

const testConfig = {
  contentTypeUid: 'api::foundation-page.foundation-page' as const,
  outputDir: 'src/content/foundation-pages',
  populate: {
    hero: { populate: '*' as const },
    seo: { populate: '*' as const },
    content: { populate: '*' as const }
  }
}

describe('generateMDX — clears deleted Strapi-managed fields', () => {
  it('removes heroImage from frontmatter when backgroundImage is deleted in Strapi', () => {
    const page = {
      id: 1,
      documentId: 'doc1',
      title: 'Test Page',
      pathSlug: 'test',
      locale: 'en',
      hero: {
        title: 'Hero Title',
        description: undefined,
        backgroundImage: undefined
      }
    }
    const preservedFields = {
      heroImage: 'https://example.com/old-image.jpg',
      heroTitle: 'Preserved Title'
    }

    const result = generateMDX(testConfig, page, preservedFields)

    expect(result).not.toContain('heroImage')
  })

  it('removes metaDescription from frontmatter when seo.metaDescription is deleted in Strapi', () => {
    const page = {
      id: 1,
      documentId: 'doc1',
      title: 'Test Page',
      pathSlug: 'test',
      locale: 'en',
      seo: { metaDescription: undefined }
    }
    const preservedFields = { metaDescription: 'Old description' }

    const result = generateMDX(testConfig, page, preservedFields)

    expect(result).not.toContain('metaDescription')
  })

  it('keeps heroImage in frontmatter when backgroundImage is present', () => {
    const page = {
      id: 1,
      documentId: 'doc1',
      title: 'Test Page',
      pathSlug: 'test',
      locale: 'en',
      hero: {
        title: 'Hero Title',
        backgroundImage: { url: 'https://example.com/image.jpg' }
      }
    }

    const result = generateMDX(testConfig, page)

    expect(result).toContain('heroImage')
    expect(result).toContain('https://example.com/image.jpg')
  })
})

describe('generateMDX — required field validation', () => {
  const base = {
    id: 1,
    documentId: 'doc1',
    title: 'Test Page',
    pathSlug: 'test',
    locale: 'en'
  }

  it('throws when hero is present but title is empty', () => {
    expect(() =>
      generateMDX(testConfig, { ...base, hero: { title: '' } })
    ).toThrow('Hero is missing required title')
  })

  it('throws when a hero CTA is missing text', () => {
    expect(() =>
      generateMDX(testConfig, {
        ...base,
        hero: {
          title: 'Hero',
          hero_call_to_action: [{ text: '', link: '/about' }]
        }
      })
    ).toThrow('Hero CTA is missing required text')
  })

  it('throws when a hero CTA is missing link', () => {
    expect(() =>
      generateMDX(testConfig, {
        ...base,
        hero: {
          title: 'Hero',
          hero_call_to_action: [{ text: 'Learn more', link: '' }]
        }
      })
    ).toThrow('Hero CTA is missing required link')
  })
})

describe('resolvePageFilepath', () => {
  const outputDir = path.join('/repo', 'src', 'content', 'foundation-pages')

  it('keeps English nested pages under slug parent directories', () => {
    expect(
      resolvePageFilepath(
        outputDir,
        { pathSlug: 'grant/grant-web' },
        defaultLang
      )
    ).toBe(path.join(outputDir, 'grant', 'grant-web.mdx'))
  })

  it('writes localized nested pages under the collection-level locale directory', () => {
    expect(
      resolvePageFilepath(outputDir, { pathSlug: 'grant/grant-web' }, 'es')
    ).toBe(path.join(outputDir, 'es', 'grant', 'grant-web.mdx'))
  })

  it('writes localized top-level pages under the collection-level locale directory', () => {
    expect(resolvePageFilepath(outputDir, { pathSlug: 'home' }, 'es')).toBe(
      path.join(outputDir, 'es', 'home.mdx')
    )
  })
})

describe('readLocaleFromUpdateEvent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to en when locale is absent', () => {
    expect(readLocaleFromUpdateEvent({ params: { documentId: 'x' } })).toBe(
      defaultLang
    )
  })

  it('uses params.locale', () => {
    expect(
      readLocaleFromUpdateEvent({
        params: { locale: 'es', documentId: 'x' }
      })
    ).toBe('es')
  })

  it('uses params.data.locale when params.locale is missing', () => {
    expect(
      readLocaleFromUpdateEvent({
        params: { data: { documentId: 'x', locale: 'fr' } }
      })
    ).toBe('fr')
  })

  it('falls back to locale on params.where (document-service update filter)', () => {
    expect(
      readLocaleFromUpdateEvent({
        params: { where: { locale: 'de' }, documentId: 'x' }
      })
    ).toBe('de')
  })
})
