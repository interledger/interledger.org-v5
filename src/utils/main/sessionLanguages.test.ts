import { describe, expect, it } from 'vitest'
import { parseSessionLanguages } from './sessionLanguages'

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
  })
})
