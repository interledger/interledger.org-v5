import { describe, expect, it } from 'vitest'
import type { Translate } from './i18'
import {
  parseSessionLanguages,
  translateSessionLanguage
} from './sessionLanguages'

describe('parseSessionLanguages', () => {
  it('reads every 2025 combination', () => {
    expect(parseSessionLanguages(['English'])).toEqual({
      spoken: ['English'],
      translatedTo: []
    })
    expect(
      parseSessionLanguages(['English', 'Spanish Translation available'])
    ).toEqual({ spoken: ['English'], translatedTo: ['Spanish'] })
    expect(
      parseSessionLanguages(['Spanish', 'English Translation available'])
    ).toEqual({ spoken: ['Spanish'], translatedTo: ['English'] })
    expect(parseSessionLanguages(['English', 'Spanish'])).toEqual({
      spoken: ['English', 'Spanish'],
      translatedTo: []
    })
  })

  it('gives empty lists for a summit that never asked', () => {
    expect(parseSessionLanguages([])).toEqual({ spoken: [], translatedTo: [] })
  })

  it('ignores case, stray whitespace and a bare suffix', () => {
    expect(
      parseSessionLanguages([' English ', 'spanish translation available'])
    ).toEqual({ spoken: ['English'], translatedTo: ['spanish'] })
    expect(parseSessionLanguages([' Translation available'])).toEqual({
      spoken: [],
      translatedTo: []
    })
    expect(parseSessionLanguages(['Spanish Translation available '])).toEqual({
      spoken: [],
      translatedTo: ['Spanish']
    })
    expect(parseSessionLanguages(['Translation available'])).toEqual({
      spoken: [],
      translatedTo: []
    })
  })
})

describe('translateSessionLanguage', () => {
  const t = ((key: string) => `ui:${key}`) as Translate

  it('maps the Sessionize language names to UI strings, ignoring case', () => {
    expect(translateSessionLanguage('English', t)).toBe(
      'ui:summit.language_english'
    )
    expect(translateSessionLanguage('spanish', t)).toBe(
      'ui:summit.language_spanish'
    )
  })

  it('keeps a language with no UI string as Sessionize wrote it', () => {
    expect(translateSessionLanguage('Portuguese', t)).toBe('Portuguese')
    expect(translateSessionLanguage('constructor', t)).toBe('constructor')
  })
})
