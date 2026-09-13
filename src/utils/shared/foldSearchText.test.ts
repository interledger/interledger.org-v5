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
  })

  it('transliterates Latin letters that NFD does not decompose', () => {
    expect(foldSearchText('Ørsted')).toBe('orsted')
    expect(foldSearchText('Łódź')).toBe('lodz')
    expect(foldSearchText('straße')).toBe('strasse')
  })

  it('is idempotent', () => {
    expect(foldSearchText(foldSearchText('México'))).toBe('mexico')
  })

  it('keeps CJK so those queries still match', () => {
    expect(foldSearchText('开放支付')).toBe('开放支付')
  })

  it('returns an empty string unchanged', () => {
    expect(foldSearchText('')).toBe('')
  })
})
