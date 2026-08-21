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

/**
 * Matches an `Authorization` header that carries bearer credentials.
 *
 * The scheme name is case-insensitive (RFC 7235 section 2.1) and one or more
 * spaces separate it from the token. Strapi's own api-token middleware accepts
 * `bearer`, `BEARER` and extra spacing, so this route must not be stricter than
 * every other authenticated route in the same application.
 */
const BEARER_CREDENTIALS = /^bearer\s+(\S.*)$/i

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
  // Node keeps only the first `Authorization` header, so this is a string or
  // undefined in practice. The type guard covers the rest of the union anyway,
  // because a wrong type must not become a truthy token.
  if (typeof header !== 'string') return null
  const token = BEARER_CREDENTIALS.exec(header.trim())?.[1]
  return token ? token.trim() : null
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
