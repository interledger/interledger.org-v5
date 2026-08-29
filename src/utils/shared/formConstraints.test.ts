import { describe, expect, it } from 'vitest'
import {
  constraintErrorKind,
  emailConstraintErrorKind,
  isValidEmailAddress
} from './formConstraints'
import { validity } from './formValidity.fixture'

describe('constraintErrorKind', () => {
  it('returns required when the field is empty', () => {
    expect(constraintErrorKind(validity({ valueMissing: true }))).toBe(
      'required'
    )
  })

  it('returns invalid for a type mismatch such as email without @', () => {
    expect(constraintErrorKind(validity({ typeMismatch: true }))).toBe(
      'invalid'
    )
  })

  it('prefers required when both flags are set', () => {
    expect(
      constraintErrorKind(validity({ valueMissing: true, typeMismatch: true }))
    ).toBe('required')
  })

  it('returns null when the field is valid', () => {
    expect(constraintErrorKind(validity({}))).toBeNull()
  })
})

describe('isValidEmailAddress', () => {
  it('accepts a standard email address', () => {
    expect(isValidEmailAddress('user@example.com')).toBe(true)
  })

  it('accepts subdomains and plus addressing', () => {
    expect(isValidEmailAddress('user+tag@mail.example.co.uk')).toBe(true)
  })

  it('rejects a hostname without a TLD', () => {
    expect(isValidEmailAddress('sdsdsd@serweref')).toBe(false)
  })

  it('rejects values without @ or a domain dot', () => {
    expect(isValidEmailAddress('not-an-email')).toBe(false)
    expect(isValidEmailAddress('user@domain')).toBe(false)
  })

  it('ignores surrounding whitespace', () => {
    expect(isValidEmailAddress('  user@example.com  ')).toBe(true)
  })
})

describe('emailConstraintErrorKind', () => {
  it('returns required for empty values even when typeMismatch is false', () => {
    expect(emailConstraintErrorKind('   ', validity({}))).toBe('required')
  })

  it('returns invalid when the browser accepts a hostname-only domain', () => {
    expect(emailConstraintErrorKind('sdsdsd@serweref', validity({}))).toBe(
      'invalid'
    )
  })

  it('returns null for a valid email address', () => {
    expect(
      emailConstraintErrorKind('user@example.com', validity({}))
    ).toBeNull()
  })
})
