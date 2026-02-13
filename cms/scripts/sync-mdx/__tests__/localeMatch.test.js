const { describe, it, expect } = require('bun:test')

const {
  addProcessedSlug,
  isProcessed,
  findMatchingLocales
} = require('../localeMatch')

describe('processed slug tracking', () => {
  it('normalizes locale when adding processed slugs', () => {
    const processedSlugs = new Map()

    addProcessedSlug(processedSlugs, 'en-US', 'about')

    expect(processedSlugs.has('en')).toBe(true)
    expect(processedSlugs.has('en-US')).toBe(false)
    expect(isProcessed(processedSlugs, 'en', 'about')).toBe(true)
    expect(isProcessed(processedSlugs, 'en-US', 'about')).toBe(true)
  })

  it('treats regional and base locale as same processed bucket', () => {
    const processedSlugs = new Map()

    addProcessedSlug(processedSlugs, 'es-419', 'sobre-nosotros')

    expect(isProcessed(processedSlugs, 'es', 'sobre-nosotros')).toBe(true)
    expect(isProcessed(processedSlugs, 'es-ES', 'sobre-nosotros')).toBe(true)
    expect(isProcessed(processedSlugs, 'fr', 'sobre-nosotros')).toBe(false)
  })
})

describe('findMatchingLocales', () => {
  it('ignores already processed locale entries by normalized locale code', () => {
    const englishMdx = { slug: 'about' }
    const localeFiles = [
      {
        slug: 'sobre-nosotros',
        locale: 'es-419',
        localizes: 'about',
        frontmatter: {}
      }
    ]
    const processedSlugs = new Map()
    addProcessedSlug(processedSlugs, 'es', 'sobre-nosotros')

    const matches = findMatchingLocales(englishMdx, localeFiles, processedSlugs)
    expect(matches).toHaveLength(0)
  })

  it('returns one locale match per base locale', () => {
    const englishMdx = { slug: 'about' }
    const localeFiles = [
      {
        slug: 'sobre-nosotros',
        locale: 'es',
        localizes: 'about',
        frontmatter: {}
      },
      {
        slug: 'sobre-nosotros-latam',
        locale: 'es-419',
        localizes: 'about',
        frontmatter: {}
      },
      {
        slug: 'a-propos',
        locale: 'fr',
        localizes: 'about',
        frontmatter: {}
      }
    ]

    const matches = findMatchingLocales(englishMdx, localeFiles, new Map())

    expect(matches).toHaveLength(2)
    expect(matches.map((m) => m.localeMdx.slug).sort()).toEqual([
      'a-propos',
      'sobre-nosotros'
    ])
  })
})
