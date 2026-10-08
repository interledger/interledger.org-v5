import { describe, expect, it } from 'vitest'
import { isFundraiseUpElementHref } from './fundraiseUp'

describe('isFundraiseUpElementHref', () => {
  it('matches an element id and nothing that is a real in-page link', () => {
    expect(isFundraiseUpElementHref('#XVSHSPQU')).toBe(true)
    expect(isFundraiseUpElementHref('#every-dollar')).toBe(false)
    expect(isFundraiseUpElementHref('#xvshspqu')).toBe(false)
    expect(isFundraiseUpElementHref('/support-us#XVSHSPQU')).toBe(false)
    expect(isFundraiseUpElementHref('https://example.com')).toBe(false)
  })
})
