import { describe, expect, it } from 'vitest'
import { redirects } from '../redirects'

describe('redirects.ts', () => {
  // Astro's Netlify adapter emits a dynamic redirect's [...rest] destination
  // as a literal `*`, so every match lands on a 404, and appends it after
  // public/_redirects, where it cannot be ordered [INTORG-1112].
  it('has no dynamic sources — write those in public/_redirects', () => {
    const dynamic = Object.keys(redirects).filter((source) =>
      source.includes('[')
    )
    expect(dynamic).toEqual([])
  })
})
