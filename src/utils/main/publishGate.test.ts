import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hideFuturePosts,
  isPublishedAt,
  resolveGateNow,
  shouldHideFuturePosts
} from './publishGate'

describe('shouldHideFuturePosts', () => {
  it('is off for a plain local build — nothing to gate against', () => {
    expect(shouldHideFuturePosts({})).toBe(false)
  })

  it('is on for a Netlify production build', () => {
    expect(shouldHideFuturePosts({ CONTEXT: 'production' })).toBe(true)
  })

  it.each(['branch-deploy', 'deploy-preview', 'dev'])(
    'is off for CONTEXT=%s, so upcoming content stays reviewable',
    (context) => {
      expect(shouldHideFuturePosts({ CONTEXT: context })).toBe(false)
    }
  )

  it('ignores case and surrounding whitespace in CONTEXT', () => {
    expect(shouldHideFuturePosts({ CONTEXT: ' PRODUCTION ' })).toBe(true)
  })

  it('is on when opted into explicitly, with no CONTEXT present', () => {
    expect(shouldHideFuturePosts({ BLOG_DATE_FILTER: 'on' })).toBe(true)
    expect(shouldHideFuturePosts({ BLOG_DATE_FILTER: ' ON ' })).toBe(true)
  })

  it('honours BLOG_DATE_FILTER=off as an escape hatch on production', () => {
    expect(
      shouldHideFuturePosts({ CONTEXT: 'production', BLOG_DATE_FILTER: 'off' })
    ).toBe(false)
    expect(
      shouldHideFuturePosts({ CONTEXT: 'production', BLOG_DATE_FILTER: 'OFF' })
    ).toBe(false)
  })

  it('falls back to CONTEXT for an unrecognised BLOG_DATE_FILTER value', () => {
    expect(
      shouldHideFuturePosts({
        CONTEXT: 'production',
        BLOG_DATE_FILTER: 'maybe'
      })
    ).toBe(true)
    expect(shouldHideFuturePosts({ BLOG_DATE_FILTER: 'maybe' })).toBe(false)
  })
})

describe('hideFuturePosts', () => {
  const originalContext = process.env.CONTEXT
  const originalFilter = process.env.BLOG_DATE_FILTER

  afterEach(() => {
    restoreEnv('CONTEXT', originalContext)
    restoreEnv('BLOG_DATE_FILTER', originalFilter)
  })

  it('falls back to the environment when the build-time define is absent', () => {
    // __HIDE_FUTURE_POSTS__ is injected by Vite `define`, so under plain vitest
    // it is undefined and the accessor must read process.env instead.
    process.env.BLOG_DATE_FILTER = 'on'
    expect(hideFuturePosts()).toBe(true)

    process.env.BLOG_DATE_FILTER = 'off'
    expect(hideFuturePosts()).toBe(false)
  })
})

describe('resolveGateNow', () => {
  it('is the current instant when nothing pins it', () => {
    const before = Date.now()
    const resolved = resolveGateNow({}).getTime()
    expect(resolved).toBeGreaterThanOrEqual(before)
    expect(resolved).toBeLessThanOrEqual(Date.now())
  })

  it('pins the instant so a build can be verified against real content', () => {
    expect(
      resolveGateNow({ BLOG_DATE_FILTER_AS_OF: '2025-01-01' }).toISOString()
    ).toBe('2025-01-01T00:00:00.000Z')
  })

  it('warns and falls back rather than silently gating on an invalid date', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveGateNow({ BLOG_DATE_FILTER_AS_OF: 'yesterday' })

    expect(Number.isNaN(resolved.getTime())).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

describe('isPublishedAt', () => {
  const now = new Date('2026-09-18T09:30:00.000Z')

  it('publishes a post dated today, at UTC midnight as frontmatter parses it', () => {
    expect(isPublishedAt(new Date('2026-09-18T00:00:00.000Z'), now)).toBe(true)
  })

  it('publishes a post timestamped later today', () => {
    expect(isPublishedAt(new Date('2026-09-18T23:59:59.999Z'), now)).toBe(true)
  })

  it('publishes a post dated in the past', () => {
    expect(isPublishedAt(new Date('2023-09-12T00:00:00.000Z'), now)).toBe(true)
  })

  it('hides a post dated tomorrow', () => {
    expect(isPublishedAt(new Date('2026-09-19T00:00:00.000Z'), now)).toBe(false)
  })

  it('measures the day boundary in UTC, not the runner local timezone', () => {
    // 23:30 on the 18th in US Eastern is already 04:30 on the 19th UTC, so a
    // post dated the 19th is published.
    const lateEastern = new Date('2026-09-18T23:30:00-05:00')
    expect(
      isPublishedAt(new Date('2026-09-19T00:00:00.000Z'), lateEastern)
    ).toBe(true)
  })

  it('publishes an entry with no date — nothing may be hidden by an unset field', () => {
    expect(isPublishedAt(undefined, now)).toBe(true)
  })

  it('publishes an entry whose date failed to parse', () => {
    expect(isPublishedAt(new Date('not a date'), now)).toBe(true)
  })
})

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}
