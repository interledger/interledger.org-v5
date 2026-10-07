import { describe, expect, it } from 'vitest'
import {
  hasFundraiseUpElementId,
  isFundraiseUpElementHref
} from './fundraiseUp'

describe('isFundraiseUpElementHref', () => {
  it('matches an element id and nothing that is a real in-page link', () => {
    expect(isFundraiseUpElementHref('#XVSHSPQU')).toBe(true)
    expect(isFundraiseUpElementHref('#every-dollar')).toBe(false)
    expect(isFundraiseUpElementHref('#xvshspqu')).toBe(false)
    expect(isFundraiseUpElementHref('/support-us#XVSHSPQU')).toBe(false)
    expect(isFundraiseUpElementHref('https://example.com')).toBe(false)
  })
})

describe('hasFundraiseUpElementId', () => {
  it('finds an element id in markup and in a nested block', () => {
    expect(hasFundraiseUpElementId("ctaLink: '#XMWLAVRZ'")).toBe(true)
    expect(
      hasFundraiseUpElementId({
        content: [{ buttons: [{ link: '#XVSHSPQU' }] }]
      })
    ).toBe(true)
  })

  it('ignores same-page anchors and empty values', () => {
    expect(hasFundraiseUpElementId('#every-dollar-working')).toBe(false)
    expect(hasFundraiseUpElementId(null)).toBe(false)
    expect(hasFundraiseUpElementId(undefined)).toBe(false)
    expect(hasFundraiseUpElementId([])).toBe(false)
  })
})
