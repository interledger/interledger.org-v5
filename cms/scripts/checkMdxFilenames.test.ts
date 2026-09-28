import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  findFilenameMismatches,
  isCaseOnlyRename,
  isRenameBlocked,
  readCollection,
  renameFile,
  resolveFileLocale,
  toIsoDate,
  type ContentFile
} from './checkMdxFilenames'

function blogFile(
  relativePath: string,
  frontmatter: Record<string, unknown>
): ContentFile {
  return { collection: 'blog', relativePath, frontmatter }
}

describe('toIsoDate', () => {
  // YAML turns a bare `date: 2026-01-22` into a Date, a quoted one into a
  // string. Both reach the check and both name the same file.
  it('formats a YAML date and a quoted date alike', () => {
    expect(toIsoDate(new Date('2026-01-22T00:00:00.000Z'))).toBe('2026-01-22')
    expect(toIsoDate('2026-01-22')).toBe('2026-01-22')
  })

  it('returns an empty string for a missing or unusable date', () => {
    expect(toIsoDate(undefined)).toBe('')
    expect(toIsoDate(null)).toBe('')
    expect(toIsoDate(42)).toBe('')
    expect(toIsoDate(new Date('not a date'))).toBe('')
  })
})

describe('resolveFileLocale', () => {
  it('prefers the declared locale', () => {
    expect(resolveFileLocale(blogFile('a.mdx', { locale: 'es' }))).toBe('es')
  })

  it('falls back to the locale folder the file sits in', () => {
    expect(resolveFileLocale(blogFile('es/a.mdx', {}))).toBe('es')
  })

  it('treats a file at the collection root as the default locale', () => {
    expect(resolveFileLocale(blogFile('a.mdx', {}))).toBe('en')
  })

  // A directory that merely looks like a locale must not be read as one.
  it('ignores a first segment that is not a known locale', () => {
    expect(resolveFileLocale(blogFile('drafts/a.mdx', {}))).toBe('en')
  })
})

describe('findFilenameMismatches', () => {
  it('reports nothing when the name matches the frontmatter', () => {
    const files = [
      blogFile('2026-05-12-ilf-and-hsms.mdx', {
        pathSlug: 'ilf-and-hsms',
        date: new Date('2026-05-12T00:00:00.000Z')
      })
    ]
    expect(findFilenameMismatches(files)).toEqual([])
  })

  // The INTORG-1237 regression: the entry was renamed, the file was not.
  it('reports the derived name when the pathSlug moved on', () => {
    const files = [
      blogFile('2026-05-12-ilf-cards-hsm-integration.mdx', {
        pathSlug: 'ilf-and-hsms',
        date: '2026-05-12'
      })
    ]
    expect(findFilenameMismatches(files)).toEqual([
      {
        collection: 'blog',
        actual: '2026-05-12-ilf-cards-hsm-integration.mdx',
        expected: '2026-05-12-ilf-and-hsms.mdx'
      }
    ])
  })

  it('reports a date prefix that no longer matches the date field', () => {
    const files = [
      blogFile('2025-12-19-go-further-with-open-payments.mdx', {
        pathSlug: 'go-further-with-open-payments',
        date: '2026-01-22'
      })
    ]
    expect(findFilenameMismatches(files)[0]?.expected).toBe(
      '2026-01-22-go-further-with-open-payments.mdx'
    )
  })

  it('names a localized file after the entry it localizes', () => {
    const files = [
      blogFile('es/2026-01-22-mas-alla-de-open-payments.mdx', {
        pathSlug: 'mas-alla-de-open-payments',
        localizes: 'go-further-with-open-payments',
        locale: 'es',
        date: '2026-01-22'
      })
    ]
    expect(findFilenameMismatches(files)[0]?.expected).toBe(
      'es/2026-01-22-go-further-with-open-payments.mdx'
    )
  })

  it('carries the section for a cross-section collection', () => {
    const files: ContentFile[] = [
      {
        collection: 'faqs',
        relativePath: 'faq.mdx',
        frontmatter: { pathSlug: 'faq', section: 'hackathon' }
      }
    ]
    expect(findFilenameMismatches(files)[0]?.expected).toBe('hackathon-faq.mdx')
  })

  it('keeps a page slug nested, so the tree mirrors the URL', () => {
    const files: ContentFile[] = [
      {
        collection: 'grantPages',
        relativePath: 'fellowship.mdx',
        frontmatter: { pathSlug: 'grant/fellowship' }
      }
    ]
    expect(findFilenameMismatches(files)[0]?.expected).toBe(
      'grant/fellowship.mdx'
    )
  })

  it('reports a file with no pathSlug as undecidable, not as a mismatch', () => {
    const [finding] = findFilenameMismatches([blogFile('stray.mdx', {})])
    expect(finding?.expected).toBeUndefined()
    expect(finding?.problem).toContain('no pathSlug')
  })

  it('reports a blank pathSlug rather than deriving `.mdx`', () => {
    const [finding] = findFilenameMismatches([
      blogFile('stray.mdx', { pathSlug: '   ' })
    ])
    expect(finding?.expected).toBeUndefined()
    expect(finding?.problem).toContain('no pathSlug')
  })
})

// These spawn real `git` processes, which are slow when the whole suite runs
// in parallel, so they get more room than the default per-test timeout.
describe('isCaseOnlyRename', () => {
  it('is true only when the two names differ by case alone', () => {
    expect(isCaseOnlyRename('Post.mdx', 'post.mdx')).toBe(true)
    expect(isCaseOnlyRename('post.mdx', 'post.mdx')).toBe(false)
    expect(isCaseOnlyRename('a.mdx', 'b.mdx')).toBe(false)
  })
})

describe('filesystem operations', { timeout: 30_000 }, () => {
  let repo: string
  let collection: string

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-filenames-'))
    execFileSync('git', ['init', '-q'], { cwd: repo })
    collection = path.join(repo, 'src/content/foundation-blog-posts')
    fs.mkdirSync(path.join(collection, 'es'), { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true })
  })

  function write(relativePath: string, body: string): void {
    fs.writeFileSync(path.join(collection, relativePath), body, 'utf-8')
  }

  describe('readCollection', () => {
    it('reads frontmatter from every locale folder and ignores other files', () => {
      write('a.mdx', '---\npathSlug: a\n---\n\nBody\n')
      write('es/a.mdx', '---\npathSlug: a\nlocale: es\n---\n\nCuerpo\n')
      write('notes.txt', 'ignored')

      const files = readCollection(repo, 'blog')

      expect(files.map((file) => file.relativePath).sort()).toEqual([
        'a.mdx',
        'es/a.mdx'
      ])
      expect(files.every((file) => file.frontmatter.pathSlug === 'a')).toBe(
        true
      )
    })

    it('returns nothing when the collection directory is absent', () => {
      expect(readCollection(repo, 'reports')).toEqual([])
    })
  })

  describe('isRenameBlocked', () => {
    it('blocks a rename onto an existing file', () => {
      write('a.mdx', 'a')
      write('b.mdx', 'b')
      expect(isRenameBlocked(collection, 'a.mdx', 'b.mdx')).toBe(true)
    })

    // On a case-insensitive filesystem the destination "exists" because it is
    // the source, so an existence check alone would skip the rename forever.
    it('allows a rename that only changes case', () => {
      write('Post.mdx', 'a')
      expect(isRenameBlocked(collection, 'Post.mdx', 'post.mdx')).toBe(false)
    })

    it('allows a rename to a free name', () => {
      write('a.mdx', 'a')
      expect(isRenameBlocked(collection, 'a.mdx', 'c.mdx')).toBe(false)
    })
  })

  describe('renameFile', () => {
    /** `git mv` refuses an untracked file, so each fixture is staged first. */
    function track(): void {
      execFileSync('git', ['add', '-A'], { cwd: repo })
    }

    it('renames a file', () => {
      write('a.mdx', 'a')
      track()

      renameFile(collection, 'a.mdx', 'b.mdx')

      expect(fs.readdirSync(collection).sort()).toEqual(['b.mdx', 'es'])
    })

    it('renames a file whose name differs only by case', () => {
      write('Post.mdx', 'a')
      track()

      renameFile(collection, 'Post.mdx', 'post.mdx')

      expect(fs.readdirSync(collection).sort()).toEqual(['es', 'post.mdx'])
    })

    it('creates the destination directory for a nested name', () => {
      write('a.mdx', 'a')
      track()

      renameFile(collection, 'a.mdx', 'grant/fellowship.mdx')

      expect(fs.existsSync(path.join(collection, 'grant/fellowship.mdx'))).toBe(
        true
      )
    })
  })
})
