import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFlatLocaleMdxLifecycle, mdxSubpath } from '@/utils'

interface Profile {
  pathSlug: string
  section: string
  locale: string
  documentId: string
  publishedAt: string
}

// INTORG-1392: on Strapi 5.57 a profile rename left the old file behind, and
// the next sync imported it as a second profile. The events below carry only
// `where.id`, as 5.57 sends them.
describe('createFlatLocaleMdxLifecycle — slug rename', () => {
  let contentDir: string
  let entries: Record<string, Profile>

  const getBaseDir = (locale?: string) =>
    locale && locale !== 'en' ? path.join(contentDir, locale) : contentDir

  function profileFile(locale: string, pathSlug: string): string {
    return path.join(
      getBaseDir(locale),
      mdxSubpath('flat-section', { pathSlug, section: 'foundation' })
    )
  }

  function seedFile(locale: string, pathSlug: string): string {
    const filepath = profileFile(locale, pathSlug)
    fs.mkdirSync(path.dirname(filepath), { recursive: true })
    fs.writeFileSync(filepath, '---\n---\n')
    return filepath
  }

  function stubStrapi(savedLocale: string) {
    vi.stubGlobal('strapi', {
      requestContext: { get: () => ({ request: { headers: {} } }) },
      db: {
        query: () => ({
          findOne: async () => ({ documentId: 'doc1', locale: savedLocale })
        })
      },
      documents: () => ({
        findOne: async ({ locale }: { locale: string }) =>
          entries[locale] ? { ...entries[locale] } : null
      })
    })
  }

  async function save(locale: string, changes: Partial<Profile>) {
    stubStrapi(locale)
    const lifecycle = createFlatLocaleMdxLifecycle<Profile>({
      contentTypeUid: 'api::profile-page.profile-page',
      label: 'profile-page',
      getBaseDir,
      namingRule: 'flat-section',
      generateContent: (entry) => `---\npathSlug: ${entry.pathSlug}\n---\n`
    })
    const state = {}
    await lifecycle.beforeUpdate({
      params: { where: { id: 7 }, data: {} },
      state
    })
    entries[locale] = { ...entries[locale], ...changes }
    await lifecycle.afterUpdate({ result: entries[locale], state })
  }

  /** `section` is not localized: one edit changes it on every locale. */
  async function changeSection(section: string) {
    stubStrapi('en')
    const lifecycle = createFlatLocaleMdxLifecycle<Profile>({
      contentTypeUid: 'api::faq.faq',
      label: 'faq',
      getBaseDir,
      namingRule: 'flat-section',
      generateContent: (entry) => `---\npathSlug: ${entry.pathSlug}\n---\n`
    })
    const state = {}
    await lifecycle.beforeUpdate({
      params: { where: { id: 7 }, data: {} },
      state
    })
    for (const locale of Object.keys(entries)) {
      entries[locale] = { ...entries[locale], section }
    }
    await lifecycle.afterUpdate({ result: entries.en, state })
  }

  beforeEach(() => {
    contentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-rename-'))
    vi.stubEnv('STRAPI_DISABLE_GIT_SYNC', 'true')
    const shared = {
      section: 'foundation',
      documentId: 'doc1',
      publishedAt: '2025-06-11'
    }
    entries = {
      en: { ...shared, pathSlug: 'jane', locale: 'en' },
      es: { ...shared, pathSlug: 'jane', locale: 'es' }
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    fs.rmSync(contentDir, { recursive: true, force: true })
  })

  // INTORG-1390: same cause, the old section was never stashed.
  it('moves every locale file when the section changes', async () => {
    const pathSlug = 'grant/education/nextgen/faq'
    entries.en.pathSlug = pathSlug
    entries.es.pathSlug = pathSlug
    const oldEn = seedFile('en', pathSlug)
    const oldEs = seedFile('es', pathSlug)

    await changeSection('summit')

    const newName = mdxSubpath('flat-section', { pathSlug, section: 'summit' })
    expect(newName).toBe('summit-grant-education-nextgen-faq.mdx')
    expect(fs.existsSync(oldEn)).toBe(false)
    expect(fs.existsSync(oldEs)).toBe(false)
    expect(fs.existsSync(path.join(getBaseDir('en'), newName))).toBe(true)
    expect(fs.existsSync(path.join(getBaseDir('es'), newName))).toBe(true)
  })

  it('moves every locale file when the English slug changes', async () => {
    const oldEn = seedFile('en', 'jane')
    const oldEs = seedFile('es', 'jane')

    await save('en', { pathSlug: 'jane-doe' })

    expect(fs.existsSync(oldEn)).toBe(false)
    expect(fs.existsSync(oldEs)).toBe(false)
    expect(fs.existsSync(profileFile('en', 'jane-doe'))).toBe(true)
    expect(fs.existsSync(profileFile('es', 'jane-doe'))).toBe(true)
  })
})
