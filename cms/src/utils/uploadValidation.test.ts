import path from 'path'
import { describe, it, expect } from 'vitest'
import { resolvePublicImagePath, validateLocalImageUrl } from './uploadValidation'

describe('resolvePublicImagePath', () => {
  const projectRoot = '/repo'
  const publicDir = path.join(projectRoot, 'public')

  it('resolves a normal path inside public/', () => {
    expect(resolvePublicImagePath(projectRoot, '/img/x.png')).toBe(
      path.join(publicDir, 'img/x.png')
    )
  })

  it('rejects a path that traverses outside public/', () => {
    const result = resolvePublicImagePath(
      projectRoot,
      '/img/../../../../etc/passwd'
    )
    expect(result).toBeInstanceOf(Error)
  })

  it('rejects a traversal attempt under /uploads/ too', () => {
    const result = resolvePublicImagePath(projectRoot, '/uploads/../../../.env')
    expect(result).toBeInstanceOf(Error)
  })
})

describe('validateLocalImageUrl', () => {
  it('surfaces the path-traversal error instead of statting an escaped path', () => {
    const result = validateLocalImageUrl(
      '/repo',
      '/img/../../../../etc/passwd'
    )
    expect(result).toBeInstanceOf(Error)
  })

  it('ignores non-local urls', () => {
    expect(validateLocalImageUrl('/repo', 'https://example.com/x.png')).toBeNull()
  })
})
