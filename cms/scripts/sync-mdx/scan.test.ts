import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { scanMDXFiles, getLocalesToCheck } from './scan'
import type { ContentTypes } from './config'

let tempDir: string

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-test-'))
})

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// Write a minimal MDX file with the given frontmatter fields.
function writeMdx(
  filePath: string,
  fields: Record<string, string>,
  body = ''
): void {
  const fm = Object.entries(fields)
    .map(([k, v]) => `${k}: '${v}'`)
    .join('\n')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `---\n${fm}\n---\n${body}`, 'utf-8')
}

function makeContentTypes(dir: string): ContentTypes {
  return {
    'foundation-pages': {
      dir,
      apiId: 'foundation-pages',
      buildPayload: vi.fn()
    },
    'summit-pages': {
      dir: '/nonexistent-summit',
      apiId: 'summit-pages',
      buildPayload: vi.fn()
    },
    'foundation-blog-posts': {
      dir: '/nonexistent-blog',
      apiId: 'foundation-blog-posts',
      buildPayload: vi.fn()
    },
    ambassadors: {
      dir: '/nonexistent-ambassadors',
      apiId: 'ambassadors',
      buildPayload: vi.fn()
    }
  } as unknown as ContentTypes
}

// ── scanMDXFiles ────────────────────────────────────────────────────────────

describe('scanMDXFiles', () => {
  it('returns empty array when base dir does not exist', () => {
    const contentTypes = makeContentTypes(path.join(tempDir, 'nonexistent'))
    expect(scanMDXFiles('foundation-pages', contentTypes)).toHaveLength(0)
  })

  it('finds English files directly in base dir', () => {
    const base = path.join(tempDir, 'foundation-pages')
    writeMdx(path.join(base, 'about.mdx'), { pathSlug: 'about', locale: 'en' })

    const files = scanMDXFiles('foundation-pages', makeContentTypes(base))

    expect(files).toHaveLength(1)
    expect(files[0].pathSlug).toBe('about')
    expect(files[0].locale).toBe('en')
    expect(files[0].isLocalization).toBe(false)
  })

  it('finds Spanish files in a flat locale dir (es/)', () => {
    const base = path.join(tempDir, 'foundation-pages')
    writeMdx(path.join(base, 'es', 'sobre.mdx'), {
      pathSlug: 'sobre',
      locale: 'es',
      localizes: 'about'
    })

    const files = scanMDXFiles('foundation-pages', makeContentTypes(base))

    expect(files).toHaveLength(1)
    expect(files[0].locale).toBe('es')
    expect(files[0].isLocalization).toBe(true)
    expect(files[0].localizes).toBe('about')
  })

  it('finds Spanish file inside the collection-level locale dir for a nested slug', () => {
    const base = path.join(tempDir, 'foundation-pages')
    writeMdx(path.join(base, 'es', 'grants', 'grant-for-web-es.mdx'), {
      pathSlug: 'grant-for-web-es',
      locale: 'es',
      localizes: 'grant-for-web'
    })

    const files = scanMDXFiles('foundation-pages', makeContentTypes(base))

    expect(files).toHaveLength(1)
    expect(files[0].pathSlug).toBe('grant-for-web-es')
    expect(files[0].locale).toBe('es')
    expect(files[0].isLocalization).toBe(true)
    expect(files[0].localizes).toBe('grant-for-web')
  })

  it('finds English files directly in a path-segment dir (grants/)', () => {
    const base = path.join(tempDir, 'foundation-pages')
    writeMdx(path.join(base, 'grants', 'grant-for-web.mdx'), {
      pathSlug: 'grant-for-web',
      locale: 'en'
    })

    const files = scanMDXFiles('foundation-pages', makeContentTypes(base))

    expect(files).toHaveLength(1)
    expect(files[0].pathSlug).toBe('grant-for-web')
    expect(files[0].locale).toBe('en')
    expect(files[0].isLocalization).toBe(false)
  })

  // The old code used the dir name as the fallback locale for all subdirs,
  // so a file in grants/ with no locale frontmatter would get locale='grants'.
  // Now path-segment dirs always default to 'en'.
  it('does not treat a path-segment dir name as a locale code', () => {
    const base = path.join(tempDir, 'foundation-pages')
    // File with no locale frontmatter inside grants/ (a non-locale dir)
    const filePath = path.join(base, 'grants', 'no-locale.mdx')
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, `---\npathSlug: 'no-locale'\n---\n`, 'utf-8')

    const files = scanMDXFiles('foundation-pages', makeContentTypes(base))

    expect(files[0].locale).toBe('en')
    expect(files[0].isLocalization).toBe(false)
  })

  it('finds both English and Spanish files across nested and flat structures', () => {
    const base = path.join(tempDir, 'foundation-pages')
    writeMdx(path.join(base, 'about.mdx'), { pathSlug: 'about', locale: 'en' })
    writeMdx(path.join(base, 'es', 'sobre.mdx'), {
      pathSlug: 'sobre',
      locale: 'es',
      localizes: 'about'
    })
    writeMdx(path.join(base, 'grants', 'grant-for-web.mdx'), {
      pathSlug: 'grant-for-web',
      locale: 'en'
    })
    writeMdx(path.join(base, 'es', 'grants', 'grant-for-web-es.mdx'), {
      pathSlug: 'grant-for-web-es',
      locale: 'es',
      localizes: 'grant-for-web'
    })

    const files = scanMDXFiles('foundation-pages', makeContentTypes(base))

    expect(files).toHaveLength(4)

    const english = files.filter((f) => !f.isLocalization)
    const spanish = files.filter((f) => f.isLocalization)

    expect(english).toHaveLength(2)
    expect(spanish).toHaveLength(2)
    expect(english.map((f) => f.pathSlug).sort()).toEqual([
      'about',
      'grant-for-web'
    ])
    expect(spanish.map((f) => f.pathSlug).sort()).toEqual([
      'grant-for-web-es',
      'sobre'
    ])
  })

  // A file with locale: 'es' in its frontmatter should be isLocalization: true
  // regardless of which directory it lives in.
  it('derives isLocalization from frontmatter locale, not directory position', () => {
    const base = path.join(tempDir, 'foundation-pages')
    // Spanish file placed directly in base dir (unusual, but frontmatter is authoritative)
    writeMdx(path.join(base, 'page-es.mdx'), {
      pathSlug: 'page-es',
      locale: 'es',
      localizes: 'page'
    })

    const files = scanMDXFiles('foundation-pages', makeContentTypes(base))

    expect(files[0].isLocalization).toBe(true)
    expect(files[0].locale).toBe('es')
  })
})

// ── getLocalesToCheck ───────────────────────────────────────────────────────

describe('getLocalesToCheck', () => {
  it('always includes en', () => {
    const contentTypes = makeContentTypes(path.join(tempDir, 'nonexistent'))
    expect(getLocalesToCheck('foundation-pages', contentTypes)).toContain('en')
  })

  it('includes locale code from a direct locale dir (es/)', () => {
    const base = path.join(tempDir, 'foundation-pages')
    fs.mkdirSync(path.join(base, 'es'), { recursive: true })

    const locales = getLocalesToCheck(
      'foundation-pages',
      makeContentTypes(base)
    )
    expect(locales).toContain('es')
  })

  it('includes locale code from a collection-level locale dir that contains nested pages', () => {
    const base = path.join(tempDir, 'foundation-pages')
    fs.mkdirSync(path.join(base, 'es', 'grants'), { recursive: true })

    const locales = getLocalesToCheck(
      'foundation-pages',
      makeContentTypes(base)
    )
    expect(locales).toContain('es')
  })

  it('does NOT include path-segment dir names as locales', () => {
    const base = path.join(tempDir, 'foundation-pages')
    fs.mkdirSync(path.join(base, 'grants'), { recursive: true })

    const locales = getLocalesToCheck(
      'foundation-pages',
      makeContentTypes(base)
    )
    expect(locales).not.toContain('grants')
  })

  it('deduplicates locale codes across content types', () => {
    const base = path.join(tempDir, 'foundation-pages')
    fs.mkdirSync(path.join(base, 'es'), { recursive: true })

    const locales = getLocalesToCheck(
      'foundation-pages',
      makeContentTypes(base)
    )
    const esCount = locales.filter((l) => l === 'es').length
    expect(esCount).toBe(1)
  })
})
