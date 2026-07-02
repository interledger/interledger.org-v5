import { describe, expect, it } from 'vitest'
import { resolveIcon } from './icons'

describe('resolveIcon', () => {
  it('maps a Linear icon name to an emoji', () => {
    expect(resolveIcon('Rocket')).toBe('🚀')
  })

  it('maps a Slack-style shortcode to a flag emoji', () => {
    expect(resolveIcon(':flag-za:')).toBe('🇿🇦')
  })

  it('passes through a raw emoji', () => {
    expect(resolveIcon('🎯')).toBe('🎯')
  })

  it('returns null for an unknown name', () => {
    expect(resolveIcon('NotARealIcon')).toBeNull()
  })

  it('returns null for null/empty input', () => {
    expect(resolveIcon(null)).toBeNull()
    expect(resolveIcon(undefined)).toBeNull()
    expect(resolveIcon('')).toBeNull()
  })
})
