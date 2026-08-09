import { describe, it, expect } from 'vitest'
import { validateCtaButtonComposition } from './ctaButtons'

const primary = { text: 'A', link: '/a', style: 'primary' }
const secondary = { text: 'B', link: '/b', style: 'secondary' }

describe('validateCtaButtonComposition', () => {
  describe('valid sets', () => {
    it('accepts a single primary', () => {
      expect(validateCtaButtonComposition([primary])).toBeNull()
    })

    it('accepts a single secondary', () => {
      expect(validateCtaButtonComposition([secondary])).toBeNull()
    })

    it('accepts primary then secondary', () => {
      expect(validateCtaButtonComposition([primary, secondary])).toBeNull()
    })

    it('accepts two secondaries', () => {
      expect(validateCtaButtonComposition([secondary, secondary])).toBeNull()
    })
  })

  describe('count', () => {
    it('rejects an empty array', () => {
      expect(validateCtaButtonComposition([])).toMatchObject({ index: null })
    })

    it('rejects undefined', () => {
      expect(validateCtaButtonComposition(undefined)).toMatchObject({
        index: null
      })
    })

    it('rejects three buttons', () => {
      expect(
        validateCtaButtonComposition([primary, secondary, secondary])
      ).toMatchObject({ index: null })
    })
  })

  describe('composition', () => {
    it('rejects two primaries', () => {
      const err = validateCtaButtonComposition([primary, primary])
      expect(err?.message).toMatch(/both be primary/)
      expect(err?.index).toBe(1)
    })

    it('rejects secondary followed by primary', () => {
      const err = validateCtaButtonComposition([secondary, primary])
      expect(err?.message).toMatch(/must come first/)
      expect(err?.index).toBe(1)
    })
  })

  describe('an unset style counts as primary, matching the schema default', () => {
    it('rejects two buttons that both omit style', () => {
      expect(
        validateCtaButtonComposition([
          { text: 'A', link: '/a' },
          { text: 'B', link: '/b' }
        ])
      ).toMatchObject({ index: 1 })
    })

    it('rejects a styleless button in second position', () => {
      const err = validateCtaButtonComposition([
        secondary,
        { text: 'B', link: '/b' }
      ])
      expect(err?.message).toMatch(/must come first/)
    })

    it('accepts a styleless button on its own', () => {
      expect(
        validateCtaButtonComposition([{ text: 'A', link: '/a' }])
      ).toBeNull()
    })
  })
})
