import path from 'path'
import { describe, expect, it } from 'vitest'
import { resolvePageFilepath } from './pageLifecycle'

describe('resolvePageFilepath', () => {
  const outputDir = path.join('/repo', 'src', 'content', 'foundation-pages')

  it('keeps English nested pages under slug parent directories', () => {
    expect(
      resolvePageFilepath(outputDir, { pathSlug: 'grant/grant-web' }, 'en')
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
