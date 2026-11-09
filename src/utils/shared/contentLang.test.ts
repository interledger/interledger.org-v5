import { describe, expect, it } from 'vitest'
import { contentLangAttr } from './contentLang'

describe('contentLangAttr', () => {
  it('returns the content locale when it differs from the page locale', () => {
    expect(contentLangAttr('en', 'es')).toBe('en')
    expect(contentLangAttr('es', 'en')).toBe('es')
  })

  it('returns undefined when the content is in the page locale', () => {
    expect(contentLangAttr('es', 'es')).toBeUndefined()
  })
})
