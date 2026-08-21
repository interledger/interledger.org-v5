import type { Context } from '@netlify/functions'
import { tryCatchAsync } from '../../src/utils/shared/tryCatch'

const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID ?? ''
const HUBSPOT_FORM_ID = process.env.HUBSPOT_FORM_ID ?? ''
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY ?? ''
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

interface SubscribeRequestBody {
  recaptchaToken?: string
  fields?: Array<{ name: string; value: string }>
  context?: Record<string, unknown>
  legalConsentOptions?: Record<string, unknown>
}

interface RecaptchaVerifyResponse {
  success: boolean
}

function isValidFields(
  fields: unknown
): fields is Array<{ name: string; value: string }> {
  return (
    Array.isArray(fields) &&
    fields.every(
      (field) =>
        typeof field === 'object' &&
        field !== null &&
        typeof (field as Record<string, unknown>).name === 'string' &&
        typeof (field as Record<string, unknown>).value === 'string'
    )
  )
}

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

async function verifyRecaptcha(token: string): Promise<boolean | Error> {
  const result = await tryCatchAsync(async () => {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: token })
    })
    if (!res.ok) {
      throw new Error(`reCAPTCHA verify HTTP ${res.status}`)
    }
    return (await res.json()) as RecaptchaVerifyResponse
  })

  if (result instanceof Error) return result
  return result.success
}

// Verifies the client's reCAPTCHA token server-side, then forwards the
// newsletter submission to HubSpot's Forms API. The client never talks to
// HubSpot directly so the portal/form ids and the recaptcha secret stay
// server-only — see the "reCAPTCHA approach" decision for the subscribe page.
export default async function handler(
  req: Request,
  _ctx: Context
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405, { Allow: 'POST' })
  }

  if (!HUBSPOT_PORTAL_ID || !HUBSPOT_FORM_ID || !RECAPTCHA_SECRET_KEY) {
    console.error(
      '[subscribe-newsletter] Missing HUBSPOT_PORTAL_ID, HUBSPOT_FORM_ID, or RECAPTCHA_SECRET_KEY'
    )
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const body = await tryCatchAsync<SubscribeRequestBody>(() => req.json())
  if (body instanceof Error) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { recaptchaToken, fields, context, legalConsentOptions } = body
  if (!recaptchaToken || !isValidFields(fields)) {
    return jsonResponse({ error: 'Missing recaptchaToken or fields' }, 400)
  }

  const recaptchaOk = await verifyRecaptcha(recaptchaToken)
  if (recaptchaOk instanceof Error) {
    console.error('[subscribe-newsletter] reCAPTCHA verify failed', recaptchaOk)
    return jsonResponse({ error: 'reCAPTCHA verification failed' }, 502)
  }
  if (!recaptchaOk) {
    return jsonResponse({ error: 'reCAPTCHA challenge not passed' }, 400)
  }

  const endpoint = `https://api-eu1.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_ID}`
  const hubspotResult = await tryCatchAsync(() =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, context, legalConsentOptions })
    })
  )

  if (hubspotResult instanceof Error) {
    console.error('[subscribe-newsletter] HubSpot request failed', hubspotResult)
    return jsonResponse({ error: 'HubSpot submission failed' }, 502)
  }

  if (!hubspotResult.ok) {
    console.error(
      `[subscribe-newsletter] HubSpot returned ${hubspotResult.status}`
    )
    return jsonResponse({ error: 'HubSpot submission failed' }, 502)
  }

  return jsonResponse({ ok: true }, 200)
}

// Static object literal: Netlify extracts function config by static analysis, so
// a computed/ternary value here would not register the path (the route would
// 404). This path works in both `netlify dev` and production.
// rateLimit is enforced by the platform before the handler runs: at most 1
// request per IP per 60s window, extra requests get an automatic 429.
export const config = {
  path: '/api/subscribe-newsletter',
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: 'ip',
    windowSize: 60,
    windowLimit: 1
  }
}
