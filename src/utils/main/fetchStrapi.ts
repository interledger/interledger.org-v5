import { stripTrailingSlash } from '../shared/url'
import { tryCatchAsync } from '../shared/tryCatch'

export interface StrapiResponse<T = unknown> {
  data: T
  meta?: unknown
}

export async function fetchStrapi<T = unknown>(
  endpoint: string
): Promise<StrapiResponse<T> | Error> {
  const base = import.meta.env.STRAPI_URL
  const token = import.meta.env.STRAPI_API_TOKEN

  if (!base || !token) {
    return new Error(
      'Strapi config missing: STRAPI_URL and STRAPI_API_TOKEN must be set'
    )
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${stripTrailingSlash(base)}/${endpoint.replace(/^\//, '')}`

  return tryCatchAsync(async () => {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    if (!res.ok) {
      throw new Error(
        `Strapi fetch failed: ${res.status} ${res.statusText} for ${endpoint}`
      )
    }
    return (await res.json()) as StrapiResponse<T>
  })
}
