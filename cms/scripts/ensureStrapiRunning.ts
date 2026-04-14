function withTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  return promiseFactory(controller.signal).finally(() => clearTimeout(timeout))
}

export async function assertStrapiRunning(
  baseUrl: string,
  timeoutMs = 4000
): Promise<void> {
  const normalized = baseUrl.replace(/\/+$/, '')
  const probeUrls = [`${normalized}/_health`, `${normalized}/admin`]

  let lastError: unknown = null

  for (const url of probeUrls) {
    try {
      const response = await withTimeout(
        (signal) => fetch(url, { method: 'GET', signal }),
        timeoutMs
      )

      // Any HTTP response means the server is reachable (even 401/403/404).
      if (response.status >= 100) return
    } catch (error) {
      lastError = error
    }
  }

  const reason =
    lastError instanceof Error ? ` (${lastError.message})` : ' (no response)'

  throw new Error(
    `Strapi does not appear to be running at ${baseUrl}${reason}\n` +
      `Start Strapi first: cd cms && pnpm run develop`
  )
}

