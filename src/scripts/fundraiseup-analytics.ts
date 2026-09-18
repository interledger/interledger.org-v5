/**
 * Bridges Fundraise Up checkout events into Umami (INTORG-1247).
 *
 * The `data-umami-event` attributes on the page's CTAs record donation
 * *intent* — someone clicked "Join Now". They cannot record the outcome,
 * because checkout runs inside a Fundraise Up iframe that we do not own and
 * cannot instrument. Fundraise Up's own JS API is the only signal that a
 * donation actually completed, so this module subscribes to it and re-emits
 * the three checkout events through `window.umami.track()`.
 *
 * Two constraints shape everything below.
 *
 * **No donor PII reaches Umami.** The `donationComplete` payload carries
 * `supporter.email`, `firstName`, `lastName` and `employer`. Umami is
 * cookie-free aggregate analytics and is the wrong home for any of it, so the
 * mapper reads an explicit allowlist of non-identifying fields rather than
 * spreading the payload. Adding a field is a deliberate act, not a default.
 *
 * **The payload is third-party and unversioned.** Fundraise Up can reshape it
 * without telling us, and a throw inside their callback would surface as a
 * broken checkout rather than a broken metric. Every read is defensive and
 * every field is optional.
 */

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, string | number>) => void
    }
    FundraiseUp?: {
      on: (event: string, callback: (details: unknown) => void) => void
    }
    /** Set before the install snippet to route checkout through test mode. */
    fundraiseup_livemode?: boolean
  }
}

/**
 * Fundraise Up event name -> Umami event name.
 *
 * Umami event names are capped at 50 characters (ADR-006) and are the primary
 * filter in its UI, so these stay short, snake_case and stable.
 */
export const FUNDRAISE_UP_UMAMI_EVENTS = {
  checkoutOpen: 'donation_checkout_open',
  checkoutClose: 'donation_checkout_close',
  donationComplete: 'donation_complete'
} as const

export type FundraiseUpEventName = keyof typeof FUNDRAISE_UP_UMAMI_EVENTS

type UmamiPayload = Record<string, string | number>

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

/**
 * Reads one nested field, e.g. `('campaign', 'name')`, and keeps it only when
 * it survives as a usable primitive.
 *
 * `NaN` and `Infinity` are rejected alongside empty strings: Umami stores a
 * numeric property as a number, and neither serialises to anything a report
 * can aggregate.
 */
function readField(
  root: Record<string, unknown> | null,
  group: string,
  key: string
): string | number | undefined {
  const container = asRecord(root?.[group])
  const value = container?.[key]

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return undefined
}

/**
 * Flattens a Fundraise Up event payload into Umami properties.
 *
 * Exported for tests and kept pure: the DOM wiring in `initFundraiseUpAnalytics`
 * stays thin enough to read, and the mapping — the part with edge cases — is
 * exercised directly.
 *
 * Absent fields are omitted rather than sent as empty strings, so an
 * unpopulated property never shows up as a phantom value in a breakdown.
 * `checkoutOpen` legitimately carries no donation data, and `checkoutClose`
 * carries nulls when the visitor dismissed the modal without giving.
 */
export function toUmamiPayload(details: unknown): UmamiPayload {
  const root = asRecord(details)
  const payload: UmamiPayload = {}

  const fields: Array<[string, string | number | undefined]> = [
    ['element_id', readField(root, 'element', 'id')],
    ['element_type', readField(root, 'element', 'type')],
    ['element_name', readField(root, 'element', 'name')],
    ['campaign_id', readField(root, 'campaign', 'id')],
    ['campaign_code', readField(root, 'campaign', 'code')],
    ['campaign_name', readField(root, 'campaign', 'name')],
    ['amount', readField(root, 'donation', 'amount')],
    ['currency', readField(root, 'donation', 'currency')],
    ['recurring', readField(root, 'donation', 'recurring')],
    ['frequency', readField(root, 'donation', 'frequency')],
    ['payment_method', readField(root, 'donation', 'paymentMethod')],
    ['designation_code', readField(root, 'designation', 'code')],
    ['designation_name', readField(root, 'designation', 'name')]
  ]

  for (const [key, value] of fields) {
    if (value !== undefined) payload[key] = value
  }

  // `livemode: false` marks a test donation. Recording it lets a report
  // exclude QA traffic instead of quietly counting it as revenue.
  if (typeof root?.livemode === 'boolean') {
    payload.livemode = root.livemode ? 'true' : 'false'
  }

  return payload
}

/**
 * Subscribes to Fundraise Up's checkout events and forwards them to Umami.
 *
 * Safe to call before either script has loaded. The install snippet stubs
 * `window.FundraiseUp` synchronously and queues calls made against it, so
 * `.on()` here registers even though the widget bundle is still in flight.
 * `window.umami` has no such stub, which is why it is resolved at fire time
 * rather than captured here — an ad blocker that drops the Umami script must
 * cost us a metric, never the donation.
 */
export function initFundraiseUpAnalytics(): void {
  const fundraiseUp = window.FundraiseUp
  if (typeof fundraiseUp?.on !== 'function') return

  for (const [eventName, umamiEvent] of Object.entries(
    FUNDRAISE_UP_UMAMI_EVENTS
  )) {
    fundraiseUp.on(eventName, (details: unknown) => {
      try {
        window.umami?.track(umamiEvent, toUmamiPayload(details))
      } catch {
        // An analytics failure must not propagate into Fundraise Up's callback
        // and take the checkout down with it.
      }
    })
  }
}
