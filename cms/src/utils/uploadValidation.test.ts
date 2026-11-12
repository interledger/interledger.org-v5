import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  findUndeletableUploads,
  resolveDeletableUploadPath,
  resolvePublicImagePath,
  validateLocalImageUrl
} from './uploadValidation'

describe('resolvePublicImagePath', () => {
  const projectRoot = '/repo'
  const publicDir = path.resolve(projectRoot, 'public')

  it('resolves a normal path inside public/', () => {
    expect(resolvePublicImagePath(projectRoot, '/img/x.png')).toBe(
      path.join(publicDir, 'img/x.png')
    )
  })

  it('resolves against cwd when projectRoot is empty', () => {
    const result = resolvePublicImagePath('', '/img/x.png')
    expect(result).not.toBeInstanceOf(Error)
    expect(String(result)).toBe(path.join(path.resolve('public'), 'img/x.png'))
  })

  it('never resolves a traversal attempt outside public/', () => {
    const result = resolvePublicImagePath(
      projectRoot,
      '/img/../../../../etc/passwd'
    )

    expect(result).not.toBeInstanceOf(Error)
    expect(result).not.toBe('/etc/passwd')
    expect(String(result).startsWith(publicDir + path.sep)).toBe(true)
  })

  it('rejects degenerate input that would resolve above public/', () => {
    expect(resolvePublicImagePath(projectRoot, '')).toBeInstanceOf(Error)
  })
})

describe('validateLocalImageUrl', () => {
  it('stats within public/ rather than an escaped system path', () => {
    // Confirms the traversal attempt cannot reach a real file (e.g. /etc/passwd)
    // that would otherwise exist on the test machine — it's always looking
    // inside public/, which won't have this file, so this returns null rather
    // than an Error.
    const result = validateLocalImageUrl('/repo', '/img/../../../../etc/passwd')
    expect(result).toBeNull()
  })

  it('ignores non-local urls', () => {
    expect(
      validateLocalImageUrl('/repo', 'https://example.com/x.png')
    ).toBeNull()
  })

  it('skips the size check for local non-image uploads (PDF/video)', () => {
    expect(
      validateLocalImageUrl('/repo', '/uploads/img/original/report.pdf')
    ).toBeNull()
    expect(
      validateLocalImageUrl('/repo', '/uploads/img/original/clip.mp4')
    ).toBeNull()
  })
})

describe('resolveDeletableUploadPath', () => {
  const uploadDir = path.resolve('/repo/public/uploads/img/original')

  it('resolves an upload by its url', () => {
    expect(
      resolveDeletableUploadPath(uploadDir, {
        url: '/uploads/img/original/logo_abc.png',
        hash: 'logo_abc',
        ext: '.png'
      })
    ).toBe(path.join(uploadDir, 'logo_abc.png'))
  })

  it('keeps a literal space in the filename', () => {
    expect(
      resolveDeletableUploadPath(uploadDir, {
        url: '/uploads/img/original/hero image.avif'
      })
    ).toBe(path.join(uploadDir, 'hero image.avif'))
  })

  it('refuses a repo image outside the uploads folder, naming it', () => {
    const result = resolveDeletableUploadPath(uploadDir, {
      url: '/img/reports/chart.svg',
      hash: 'chart',
      ext: '.svg',
      name: 'chart.svg'
    })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('“chart.svg”')
    expect((result as Error).message).toMatch(/can't be deleted or replaced/)
  })

  // Seeded /img records use the bare filename as their hash, so a hash-first
  // lookup would have unlinked an unrelated upload with the same name.
  it('never falls back to an upload with the same hash', () => {
    const result = resolveDeletableUploadPath(uploadDir, {
      url: '/img/logo.png',
      hash: 'logo',
      ext: '.png'
    })
    expect(result).toBeInstanceOf(Error)
  })

  it('falls back to the url when the name is missing', () => {
    const result = resolveDeletableUploadPath(uploadDir, { url: '/img/x.png' })
    expect((result as Error).message).toContain('“/img/x.png”')
  })

  it('refuses a sibling folder that only shares the prefix', () => {
    const result = resolveDeletableUploadPath(uploadDir, {
      url: '/uploads/img/original-backup/x.png'
    })
    expect(result).toBeInstanceOf(Error)
  })

  it('refuses a url that escapes the uploads folder', () => {
    const result = resolveDeletableUploadPath(uploadDir, {
      url: '/uploads/img/original/../../../img/x.png'
    })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/escapes the uploads folder/)
  })

  it('refuses the uploads folder itself', () => {
    const result = resolveDeletableUploadPath(uploadDir, {
      url: '/uploads/img/original/'
    })
    expect(result).toBeInstanceOf(Error)
  })

  it('falls back to the hash when there is no url', () => {
    expect(
      resolveDeletableUploadPath(uploadDir, {
        url: null,
        hash: 'a',
        ext: '.png'
      })
    ).toBe(path.join(uploadDir, 'a.png'))
  })

  it('refuses a hash that escapes the uploads folder', () => {
    const result = resolveDeletableUploadPath(uploadDir, {
      hash: '../../../img/logo',
      ext: '.png'
    })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns null when there is neither url nor hash', () => {
    expect(resolveDeletableUploadPath(uploadDir, {})).toBeNull()
  })
})

describe('findUndeletableUploads', () => {
  const uploadDir = path.resolve('/repo/public/uploads/img/original')

  it('passes a batch of uploads', () => {
    expect(
      findUndeletableUploads(uploadDir, [
        { url: '/uploads/img/original/a.png' },
        { url: '/uploads/img/original/b.pdf' }
      ])
    ).toBeNull()
  })

  it('passes an empty batch', () => {
    expect(findUndeletableUploads(uploadDir, [])).toBeNull()
  })

  it('names every repo image in a mixed batch', () => {
    const result = findUndeletableUploads(uploadDir, [
      { url: '/uploads/img/original/a.png', name: 'a.png' },
      { url: '/img/logo.png', name: 'logo.png' },
      { url: '/img/hero.avif', name: 'hero.avif' }
    ])
    expect(result).toBeInstanceOf(Error)
    expect(result?.message).toContain('“logo.png”, “hero.avif” are site images')
    expect(result?.message).not.toContain('a.png”')
  })
})
