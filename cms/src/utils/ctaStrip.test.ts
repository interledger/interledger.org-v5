import { describe, expect, it } from 'vitest'
import {
  ctaStripColorMdxFields,
  ctaStripColorPayload,
  isCtaStripColor
} from './ctaStrip'

describe('cta strip colour', () => {
  it('accepts only purple and green', () => {
    expect(isCtaStripColor('purple')).toBe(true)
    expect(isCtaStripColor('green')).toBe(true)
    expect(isCtaStripColor('blue')).toBe(false)
    expect(isCtaStripColor(undefined)).toBe(false)
  })

  it('omits colour from MDX unless the strip is green', () => {
    expect(ctaStripColorMdxFields('green')).toEqual({ color: 'green' })
    expect(ctaStripColorMdxFields('purple')).toEqual({})
    expect(ctaStripColorMdxFields(undefined)).toEqual({})
  })

  it('sends purple unless the strip is green, so a PUT can clear it', () => {
    expect(ctaStripColorPayload('green')).toBe('green')
    expect(ctaStripColorPayload('purple')).toBe('purple')
    expect(ctaStripColorPayload(undefined)).toBe('purple')
    expect(ctaStripColorPayload('blue')).toBe('purple')
  })
})
