import path from 'path'
import { describe, it, expect } from 'vitest'
import {
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
    expect(String(result)).toBe(
      path.join(path.resolve('public'), 'img/x.png')
    )
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
