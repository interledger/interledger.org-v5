const { describe, it, expect, afterEach } = require('bun:test')
const fs = require('fs')
const path = require('path')

const { syncContentType } = require('../sync')
const { makeTmpDir, writeFile, registerCleanup } = require('./helpers')

registerCleanup(afterEach)

describe('syncContentType', () => {
  it('matches locale file via localizes field', async () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const summitDir = path.join(contentRoot, 'summit')
    const esSummitDir = path.join(contentRoot, 'es', 'summit')

    writeFile(
      path.join(summitDir, 'about.mdx'),
      ['---', 'title: "About"', '---', '', 'Body'].join('\n')
    )

    writeFile(
      path.join(esSummitDir, 'sobre-nosotros.mdx'),
      [
        '---',
        'title: "Sobre Nosotros"',
        'locale: "es"',
        'localizes: "about"',
        '---',
        '',
        'Contenido'
      ].join('\n')
    )

    const existingEntry = {
      documentId: 'doc-about',
      slug: 'about',
      locale: 'en'
    }

    const calls = { createLocalization: 0 }

    const strapi = {
      getAllEntries: async () => [existingEntry],
      findBySlug: async (apiId, slug, locale) => {
        if (locale === 'en' && slug === 'about') return existingEntry
        return null
      },
      createLocalization: async () => {
        calls.createLocalization++
      },
      updateLocalization: async () => {},
      updateEntry: async () => ({ data: existingEntry }),
      createEntry: async () => ({ data: existingEntry }),
      deleteEntry: async () => {}
    }

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    }

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    })

    expect(calls.createLocalization).toBe(1)
  })

  it('creates English entry without modifying MDX (import-only)', async () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const summitDir = path.join(contentRoot, 'summit')

    const originalContent = ['---', 'title: "New Page"', '---', '', 'Body'].join('\n')
    writeFile(path.join(summitDir, 'new-page.mdx'), originalContent)

    const createdEntry = {
      documentId: 'new-doc-id',
      slug: 'new-page',
      locale: 'en'
    }

    const strapi = {
      getAllEntries: async () => [],
      findBySlug: async () => null,
      createLocalization: async () => {},
      updateLocalization: async () => {},
      updateEntry: async () => ({ data: createdEntry }),
      createEntry: async () => ({ data: createdEntry }),
      deleteEntry: async () => {}
    }

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    }

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    })

    const englishContent = fs.readFileSync(path.join(summitDir, 'new-page.mdx'), 'utf-8')
    expect(englishContent).toBe(originalContent)
    expect(englishContent).not.toContain('contentId')
  })

  it('creates localization for summit pages using localizes field', async () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const summitDir = path.join(contentRoot, 'summit')
    const esSummitDir = path.join(contentRoot, 'es', 'summit')

    writeFile(
      path.join(summitDir, 'code-of-conduct.mdx'),
      ['---', 'title: "Code of Conduct"', '---', '', 'Body'].join('\n')
    )

    writeFile(
      path.join(esSummitDir, 'codigo-de-conducta.mdx'),
      [
        '---',
        'title: "Código de conducta"',
        'locale: "es"',
        'localizes: "code-of-conduct"',
        '---',
        '',
        'Contenido'
      ].join('\n')
    )

    const existingEntry = {
      documentId: 'doc-1',
      slug: 'code-of-conduct',
      locale: 'en'
    }

    const calls = {
      createLocalization: 0,
      updateLocalization: 0
    }

    const strapi = {
      getAllEntries: async () => [existingEntry],
      findBySlug: async (apiId, slug, locale) => {
        if (locale === 'en' && slug === 'code-of-conduct') return existingEntry
        return null
      },
      createLocalization: async () => {
        calls.createLocalization++
      },
      updateLocalization: async () => {
        calls.updateLocalization++
      },
      updateEntry: async () => ({ data: existingEntry }),
      createEntry: async () => ({ data: { documentId: 'doc-1', slug: 'code-of-conduct' } }),
      deleteEntry: async () => {}
    }

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    }

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    })

    expect(calls.createLocalization).toBe(1)
    expect(calls.updateLocalization).toBe(0)
  })

  it('syncs localization to Strapi without modifying MDX (import-only)', async () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const summitDir = path.join(contentRoot, 'summit')
    const esSummitDir = path.join(contentRoot, 'es', 'summit')

    const spanishOriginal = [
      '---',
      'title: "Sobre Nosotros"',
      'locale: "es"',
      'localizes: "new-english-slug"',
      '---',
      '',
      'Contenido'
    ].join('\n')

    writeFile(
      path.join(summitDir, 'new-english-slug.mdx'),
      ['---', 'title: "About Us"', '---', '', 'Body'].join('\n')
    )
    writeFile(path.join(esSummitDir, 'sobre-nosotros.mdx'), spanishOriginal)

    const existingEntry = {
      documentId: 'shared-content-id',
      slug: 'new-english-slug',
      locale: 'en'
    }

    const strapi = {
      getAllEntries: async () => [existingEntry],
      findBySlug: async (apiId, slug, locale) => {
        if (locale === 'en' && slug === 'new-english-slug') return existingEntry
        return null
      },
      createLocalization: async () => {},
      updateLocalization: async () => {},
      updateEntry: async () => ({ data: existingEntry }),
      createEntry: async () => ({ data: existingEntry }),
      deleteEntry: async () => {}
    }

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    }

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    })

    const localeContent = fs.readFileSync(path.join(esSummitDir, 'sobre-nosotros.mdx'), 'utf-8')
    expect(localeContent).toBe(spanishOriginal)
  })

  it('does not call mutating Strapi methods in dry-run', async () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const summitDir = path.join(contentRoot, 'summit')

    writeFile(
      path.join(summitDir, 'code-of-conduct.mdx'),
      ['---', 'title: "Code of Conduct"', '---', '', 'Body'].join('\n')
    )

    const calls = {
      createLocalization: 0,
      updateLocalization: 0,
      updateEntry: 0,
      createEntry: 0,
      deleteEntry: 0
    }

    const strapi = {
      getAllEntries: async () => [],
      findBySlug: async () => null,
      createLocalization: async () => {
        calls.createLocalization++
      },
      updateLocalization: async () => {
        calls.updateLocalization++
      },
      updateEntry: async () => {
        calls.updateEntry++
      },
      createEntry: async () => {
        calls.createEntry++
      },
      deleteEntry: async () => {
        calls.deleteEntry++
      }
    }

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    }

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: true
    })

    expect(calls.createEntry).toBe(0)
    expect(calls.updateEntry).toBe(0)
    expect(calls.createLocalization).toBe(0)
    expect(calls.updateLocalization).toBe(0)
    expect(calls.deleteEntry).toBe(0)
  })

  it('matches unmatched locale files to Strapi entries via localizes', async () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const summitDir = path.join(contentRoot, 'summit')
    const esSummitDir = path.join(contentRoot, 'es', 'summit')

    fs.mkdirSync(summitDir, { recursive: true })

    writeFile(
      path.join(esSummitDir, 'sobre.mdx'),
      [
        '---',
        'title: "Sobre"',
        'locale: "es"',
        'localizes: "about"',
        '---',
        '',
        'Contenido'
      ].join('\n')
    )

    const entry = {
      documentId: 'doc-about',
      slug: 'about',
      locale: 'en'
    }

    const calls = { createLocalization: 0, updateLocalization: 0 }

    const strapi = {
      getAllEntries: async () => [entry],
      findBySlug: async () => null,
      createLocalization: async () => {
        calls.createLocalization++
      },
      updateLocalization: async () => {
        calls.updateLocalization++
      },
      updateEntry: async () => ({ data: entry }),
      createEntry: async () => ({ data: entry }),
      deleteEntry: async () => {}
    }

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    }

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    })

    expect(calls.createLocalization).toBe(1)
    expect(calls.updateLocalization).toBe(0)

    const localeContent = fs.readFileSync(path.join(esSummitDir, 'sobre.mdx'), 'utf-8')
    expect(localeContent).toContain('localizes: "about"')
  })

  it('deletes orphaned English entries not present in MDX', async () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const summitDir = path.join(contentRoot, 'summit')

    writeFile(
      path.join(summitDir, 'keep.mdx'),
      ['---', 'title: "Keep"', '---', '', 'Body'].join('\n')
    )

    const entries = [
      { documentId: 'doc-keep', slug: 'keep', locale: 'en' },
      { documentId: 'doc-remove', slug: 'remove', locale: 'en' }
    ]

    const calls = { deleteEntry: [] }

    const strapi = {
      getAllEntries: async () => entries,
      findBySlug: async (apiId, slug, locale) => {
        if (locale === 'en' && slug === 'keep') return entries[0]
        return null
      },
      createLocalization: async () => {},
      updateLocalization: async () => {},
      updateEntry: async () => ({ data: entries[0] }),
      createEntry: async () => ({ data: entries[0] }),
      deleteEntry: async (apiId, documentId) => {
        calls.deleteEntry.push(documentId)
      }
    }

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    }

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    })

    expect(calls.deleteEntry).toEqual(['doc-remove'])
  })
})
