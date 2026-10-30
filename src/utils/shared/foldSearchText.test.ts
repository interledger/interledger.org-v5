import { describe, expect, it } from 'vitest'
import { foldSearchText } from './foldSearchText'

describe('foldSearchText', () => {
  it('lowercases ASCII', () => {
    expect(foldSearchText('Mexico')).toBe('mexico')
  })

  it('strips Latin diacritics so accented and plain forms match', () => {
    expect(foldSearchText('México')).toBe('mexico')
    expect(foldSearchText('José')).toBe('jose')
    expect(foldSearchText('São Paulo')).toBe('sao paulo')
    expect(foldSearchText('Néstor')).toBe('nestor')
    expect(foldSearchText('Medellín')).toBe('medellin')
    expect(foldSearchText('Tenorio-Fornés')).toBe('tenorio fornes')
  })

  it('folds a decomposed accent the same as a precomposed one', () => {
    expect(foldSearchText('e\u0301')).toBe('e')
    expect(foldSearchText('e\u0301')).toBe(foldSearchText('é'))
  })

  it('transliterates Latin letters that NFD does not decompose', () => {
    expect(foldSearchText('Ørsted')).toBe('orsted')
    expect(foldSearchText('Łódź')).toBe('lodz')
    expect(foldSearchText('straße')).toBe('strasse')
    expect(foldSearchText('Đặng')).toBe('dang')
    expect(foldSearchText('İstanbul')).toBe('istanbul')
  })

  it('drops apostrophes and quotes so curly and straight forms match', () => {
    expect(foldSearchText('What’s happened')).toBe('whats happened')
    expect(foldSearchText("what's happened")).toBe('whats happened')
    expect(foldSearchText('whats happened')).toBe('whats happened')
    expect(foldSearchText('The People’s Clearinghouse')).toBe(
      'the peoples clearinghouse'
    )
    expect(foldSearchText("The People's Clearinghouse")).toBe(
      'the peoples clearinghouse'
    )
    expect(foldSearchText('Côte d’Ivoire')).toBe('cote divoire')
    expect(foldSearchText("Côte d'Ivoire")).toBe('cote divoire')
    expect(foldSearchText('“Interledger on Campus”')).toBe(
      'interledger on campus'
    )
  })

  it('treats hyphens and dashes as spaces', () => {
    expect(foldSearchText('Kanzu Microloans – Real-Time')).toBe(
      'kanzu microloans real time'
    )
    expect(foldSearchText('Kanzu Microloans - Real-Time')).toBe(
      'kanzu microloans real time'
    )
    expect(foldSearchText('Kanzu Microloans real time')).toBe(
      'kanzu microloans real time'
    )
    expect(foldSearchText('covid\u201119')).toBe('covid 19')
    expect(foldSearchText('dpi\u2010enabled')).toBe('dpi enabled')
  })

  it('joins words split by odd spaces or invisible characters', () => {
    expect(foldSearchText('the\u00A0network')).toBe('the network')
    expect(foldSearchText('pay\u00ADments')).toBe('payments')
    expect(foldSearchText('pay\u200Bments')).toBe('payments')
  })

  it('folds compatibility forms the user would type in ASCII', () => {
    expect(foldSearchText('ﬁle')).toBe('file')
    expect(foldSearchText('ｎ²')).toBe('n2')
  })

  it('keeps literal C# and underscores', () => {
    expect(foldSearchText('Built in C# with an A_B fallback.')).toBe(
      'built in c# with an a_b fallback.'
    )
  })

  it('is idempotent', () => {
    const folded = foldSearchText('What’s — São Paulo, Côte d’Ivoire')
    expect(foldSearchText(folded)).toBe(folded)
    expect(foldSearchText(foldSearchText('México'))).toBe('mexico')
  })

  it('keeps CJK so those queries still match', () => {
    expect(foldSearchText('开放支付')).toBe('开放支付')
  })

  it('returns an empty string unchanged', () => {
    expect(foldSearchText('')).toBe('')
    expect(foldSearchText('  \u00A0  ')).toBe('')
  })
})
