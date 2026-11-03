/**
 * Logs why a preview route could not load its document from Strapi.
 *
 * The route answers with the 404 page whatever the cause, so when Strapi is
 * down or the API token has expired, this log is the only record of it.
 */
export function logPreviewFetchError(
  route: string,
  document: string,
  error: Error
): void {
  console.error(`[${route}] Could not load ${document} from Strapi:`, error)
}
