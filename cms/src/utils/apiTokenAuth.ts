/**
 * Bearer-token authorization for routes registered straight onto the Koa
 * router.
 *
 * Such a route bypasses Strapi's api-token middleware, so `ctx.state.auth` is
 * never populated and the handler has to check the caller itself. The first
 * version of `POST /api/seed-media` compared the bearer against
 * `process.env.STRAPI_API_TOKEN`. That variable is a client-side setting: the
 * sync scripts read it from the repo root `.env`, and the deployed Strapi
 * processes do not carry it. The comparison therefore ran against `undefined`
 * and rejected every caller (INTORG-1098).
 *
 * These helpers check the bearer against Strapi's own `admin::api-token`
 * records instead, so any token an admin issued works and the server needs no
 * extra environment variable.
 */

const BEARER_PREFIX = 'Bearer '

/** The subset of `admin::api-token` this module uses. */
interface ApiTokenService {
  hash: (accessKey: string) => string
  getBy: (
    whereParams: Record<string, unknown>
  ) => Promise<{ type?: string } | null>
}

interface StrapiWithService {
  service: (uid: string) => unknown
}

/**
 * Reads the token out of an `Authorization` header.
 *
 * Returns `null` when the header is absent, is not a bearer header, or carries
 * an empty token. A missing header is a normal request shape rather than a
 * failure, so this is a `null` and not an `Error`.
 */
export function extractBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') return null
  if (!header.startsWith(BEARER_PREFIX)) return null
  const token = header.slice(BEARER_PREFIX.length).trim()
  return token.length > 0 ? token : null
}

/**
 * Reports whether the token belongs to a full-access API token.
 *
 * Read-only and custom tokens are rejected: every caller of this check writes
 * to the database. Returns an `Error` when the token service is unavailable or
 * the lookup throws, so the caller can answer 500 rather than a misleading 401.
 */
export async function isFullAccessApiToken(
  strapi: StrapiWithService,
  token: string
): Promise<boolean | Error> {
  const service = strapi.service('admin::api-token') as
    | ApiTokenService
    | undefined

  if (
    !service ||
    typeof service.hash !== 'function' ||
    typeof service.getBy !== 'function'
  ) {
    return new Error(
      'The admin::api-token service is unavailable, so the bearer token cannot be checked.'
    )
  }

  try {
    const record = await service.getBy({ accessKey: service.hash(token) })
    return record?.type === 'full-access'
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }
}
