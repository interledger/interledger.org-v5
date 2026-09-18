import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  FUNDRAISE_UP_UMAMI_EVENTS,
  initFundraiseUpAnalytics,
  toUmamiPayload
} from './fundraiseup-analytics'

/**
 * A `donationComplete` payload shaped after Fundraise Up's documented schema,
 * including the supporter block the mapper must never forward.
 */
const donationComplete = {
  livemode: true,
  campaign: { id: 'CMP123', code: 'FOUNDING', name: 'Founding Sustaining' },
  element: { id: 'XVSHSPQU', type: 'donateButton', name: 'Sustaining CTA' },
  supporter: {
    id: 'SUP1',
    email: 'donor@example.org',
    firstName: 'Ada',
    lastName: 'Lovelace',
    employer: 'Interledger',
    anonymous: false
  },
  donation: {
    id: 'DON1',
    amount: 100,
    currency: 'USD',
    recurring: true,
    frequency: 'monthly',
    paymentMethod: 'card',
    feesCovered: true
  },
  designation: { id: 'DSG1', code: 'GENERAL', name: 'General designation' },
  utm: { source: 'newsletter', medium: 'email' }
}

describe('toUmamiPayload', () => {
  it('flattens the documented donationComplete fields', () => {
    expect(toUmamiPayload(donationComplete)).toEqual({
      element_id: 'XVSHSPQU',
      element_type: 'donateButton',
      element_name: 'Sustaining CTA',
      campaign_id: 'CMP123',
      campaign_code: 'FOUNDING',
      campaign_name: 'Founding Sustaining',
      amount: 100,
      currency: 'USD',
      recurring: 'true',
      frequency: 'monthly',
      payment_method: 'card',
      designation_code: 'GENERAL',
      designation_name: 'General designation',
      livemode: 'true'
    })
  })

  it('forwards no donor PII, even though the payload carries it', () => {
    const serialised = JSON.stringify(toUmamiPayload(donationComplete))

    expect(serialised).not.toContain('donor@example.org')
    expect(serialised).not.toContain('Ada')
    expect(serialised).not.toContain('Lovelace')
    expect(serialised).not.toContain('SUP1')
  })

  it('keeps a checkoutOpen payload, which has no donation block', () => {
    expect(
      toUmamiPayload({
        livemode: true,
        campaign: { id: 'CMP123', code: 'FOUNDING', name: 'Founding' },
        element: { id: 'XMWLAVRZ', type: 'donateButton', name: 'Champions' }
      })
    ).toEqual({
      element_id: 'XMWLAVRZ',
      element_type: 'donateButton',
      element_name: 'Champions',
      campaign_id: 'CMP123',
      campaign_code: 'FOUNDING',
      campaign_name: 'Founding',
      livemode: 'true'
    })
  })

  it('drops the null blocks a dismissed checkoutClose sends', () => {
    expect(
      toUmamiPayload({
        livemode: true,
        element: { id: 'XVSHSPQU', type: 'donateButton', name: 'Sustaining' },
        supporter: null,
        donation: null,
        designation: null
      })
    ).toEqual({
      element_id: 'XVSHSPQU',
      element_type: 'donateButton',
      element_name: 'Sustaining',
      livemode: 'true'
    })
  })

  it('records a test-mode donation as livemode=false so reports can exclude it', () => {
    expect(toUmamiPayload({ livemode: false }).livemode).toBe('false')
  })

  it('omits livemode entirely when it is absent rather than guessing', () => {
    expect(toUmamiPayload({ element: { id: 'X' } })).not.toHaveProperty(
      'livemode'
    )
  })

  it('drops empty and whitespace-only strings instead of sending blanks', () => {
    expect(
      toUmamiPayload({
        element: { id: '', type: '   ', name: 'Kept' }
      })
    ).toEqual({ element_name: 'Kept' })
  })

  it('trims surrounding whitespace off string values', () => {
    expect(toUmamiPayload({ donation: { currency: '  USD  ' } })).toEqual({
      currency: 'USD'
    })
  })

  it('sends a one-off gift as recurring=false, not as a missing field', () => {
    expect(toUmamiPayload({ donation: { recurring: false } })).toEqual({
      recurring: 'false'
    })
  })

  it('keeps a zero amount, which is falsy but meaningful', () => {
    expect(toUmamiPayload({ donation: { amount: 0 } })).toEqual({ amount: 0 })
  })

  it('drops non-finite numbers that no report could aggregate', () => {
    expect(toUmamiPayload({ donation: { amount: Number.NaN } })).toEqual({})
    expect(toUmamiPayload({ donation: { amount: Infinity } })).toEqual({})
  })

  it('drops object and array values rather than stringifying them', () => {
    expect(
      toUmamiPayload({
        donation: { amount: { value: 100 }, currency: ['USD'] }
      })
    ).toEqual({})
  })

  it('survives a payload reshaped out from under us', () => {
    expect(toUmamiPayload(undefined)).toEqual({})
    expect(toUmamiPayload(null)).toEqual({})
    expect(toUmamiPayload('donationComplete')).toEqual({})
    expect(toUmamiPayload(42)).toEqual({})
    expect(toUmamiPayload([donationComplete])).toEqual({})
    expect(toUmamiPayload({ element: 'XVSHSPQU' })).toEqual({})
  })
})

describe('initFundraiseUpAnalytics', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window
    } else {
      ;(globalThis as Record<string, unknown>).window = originalWindow
    }
  })

  /** Stands in for the DOM the repo's test setup does not provide. */
  function stubWindow(overrides: Record<string, unknown> = {}) {
    const handlers = new Map<string, (details: unknown) => void>()
    const track = vi.fn()
    const win = {
      umami: { track },
      FundraiseUp: {
        on: (event: string, callback: (details: unknown) => void) => {
          handlers.set(event, callback)
        }
      },
      ...overrides
    }
    ;(globalThis as Record<string, unknown>).window = win
    return { handlers, track, win }
  }

  it('subscribes to every Fundraise Up event it maps', () => {
    const { handlers } = stubWindow()

    initFundraiseUpAnalytics()

    expect([...handlers.keys()].sort()).toEqual(
      Object.keys(FUNDRAISE_UP_UMAMI_EVENTS).sort()
    )
  })

  it('tracks a completed donation under the mapped Umami event name', () => {
    const { handlers, track } = stubWindow()
    initFundraiseUpAnalytics()

    handlers.get('donationComplete')?.(donationComplete)

    expect(track).toHaveBeenCalledWith(
      'donation_complete',
      expect.objectContaining({ amount: 100, currency: 'USD' })
    )
  })

  it('keeps every Umami event name inside the 50-character cap (ADR-006)', () => {
    for (const name of Object.values(FUNDRAISE_UP_UMAMI_EVENTS)) {
      expect(name.length).toBeLessThanOrEqual(50)
    }
  })

  it('does nothing when the Fundraise Up script never loaded', () => {
    stubWindow({ FundraiseUp: undefined })

    expect(() => initFundraiseUpAnalytics()).not.toThrow()
  })

  it('still lets checkout run when Umami is blocked', () => {
    const { handlers } = stubWindow({ umami: undefined })
    initFundraiseUpAnalytics()

    expect(() =>
      handlers.get('donationComplete')?.(donationComplete)
    ).not.toThrow()
  })

  it('swallows a throwing tracker so it cannot break the checkout', () => {
    const { handlers } = stubWindow({
      umami: {
        track: () => {
          throw new Error('umami exploded')
        }
      }
    })
    initFundraiseUpAnalytics()

    expect(() => handlers.get('checkoutOpen')?.({})).not.toThrow()
  })
})
