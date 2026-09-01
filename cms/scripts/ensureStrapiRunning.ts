function withTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  return promiseFactory(controller.signal).finally(() => clearTimeout(timeout))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const PROBE_ATTEMPT_TIMEOUT_MS = 4000
const PROBE_RETRY_DELAY_MS = 1000
const PROBE_TOTAL_BUDGET_MS = 15000

export async function assertStrapiRunning(
  baseUrl: string,
  totalBudgetMs = PROBE_TOTAL_BUDGET_MS
): Promise<void> {
  // Strip trailing slashes so appending "/_health" can't produce "//_health".
  const normalized = baseUrl.replace(/\/+$/, '')
  const probeUrl = `${normalized}/_health`
  // Absolute timestamp (ms) after which we stop retrying and give up.
  const deadline = Date.now() + totalBudgetMs

  let lastError: unknown

  while (Date.now() < deadline) {
    // Cap the attempt itself to whatever's left, so a hung fetch can't blow
    // through the caller's budget on its own.
    const attemptTimeoutMs = Math.min(PROBE_ATTEMPT_TIMEOUT_MS, deadline - Date.now())

    try {
      const response = await withTimeout(
        (signal) => fetch(probeUrl, { method: 'GET', signal }),
        attemptTimeoutMs
      )

      // Any response below 500 means Strapi itself answered (even
      // 401/403/404). A 5xx can mean the origin isn't actually up yet -
      // e.g. Cloudflare returning 502 while Strapi is still starting -
      // so keep retrying instead of treating it as reachable.
      if (response.status < 500) return
      lastError = new Error(`received status ${response.status}`)
    } catch (error) {
      lastError = error
    }

    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) break
    await sleep(Math.min(PROBE_RETRY_DELAY_MS, remainingMs))
  }

  const reason =
    lastError instanceof Error ? ` (${lastError.message})` : ' (no response)'

  throw new Error(
    `Strapi does not appear to be running at ${baseUrl}${reason}\n` +
      `Start Strapi first: cd cms && pnpm run develop`
  )
}
