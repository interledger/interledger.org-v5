export interface StrapiEntry {
  documentId: string
  slug: string
  locale?: string
  [key: string]: unknown
}

export interface StrapiClient {
  request: (endpoint: string, options?: RequestInit) => Promise<unknown>
  getAllEntries: (apiId: string, locale?: string) => Promise<StrapiEntry[]>
  findBySlug: (apiId: string, slug: string, locale?: string | null) => Promise<StrapiEntry | null>
  createLocalization: (apiId: string, documentId: string, locale: string, data: Record<string, unknown>) => Promise<unknown>
  updateLocalization: (apiId: string, documentId: string, locale: string, data: Record<string, unknown>) => Promise<unknown>
  createEntry: (apiId: string, data: Record<string, unknown>, locale?: string | null) => Promise<{ data: StrapiEntry }>
  updateEntry: (apiId: string, documentId: string, data: Record<string, unknown>, locale?: string | null) => Promise<{ data: StrapiEntry }>
  deleteEntry: (apiId: string, documentId: string) => Promise<unknown>
  deleteLocalization: (apiId: string, documentId: string, locale: string) => Promise<unknown>
}

interface StrapiClientOptions {
  baseUrl: string
  token: string
}

export function createStrapiClient({ baseUrl, token }: StrapiClientOptions): StrapiClient {
  async function request(endpoint: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${baseUrl}/api/${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-skip-mdx-export': 'true', // Skip lifecycle MDX export - sync script is import-only
        ...options.headers
      }
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Strapi API error (${response.status}): ${text}`)
    }

    const text = await response.text()
    if (!text) return null

    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  async function getAllEntries(apiId: string, locale = 'all'): Promise<StrapiEntry[]> {
    const allEntries: StrapiEntry[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const localeParam =
        locale === 'all' ? 'locale=all' : locale ? `locale=${locale}` : ''
      const paginationParam = `pagination[page]=${page}&pagination[pageSize]=100`
      const endpoint = `${apiId}?${paginationParam}`
      const finalEndpoint = endpoint + (localeParam ? `&${localeParam}` : '')

      const data = await request(finalEndpoint) as { data: StrapiEntry[]; meta?: { pagination?: { pageCount: number } } }
      const entries = data.data || []
      allEntries.push(...entries)

      const pagination = data.meta?.pagination
      hasMore = pagination !== undefined && page < pagination.pageCount
      page++
    }

    return allEntries
  }

  async function findBySlug(apiId: string, slug: string, locale: string | null = null): Promise<StrapiEntry | null> {
    let endpoint = `${apiId}?filters[slug][$eq]=${slug}`
    if (locale) {
      endpoint += `&locale=${locale}`
    }
    const data = await request(endpoint) as { data: StrapiEntry[] }
    return data.data && data.data.length > 0 ? data.data[0] : null
  }

  async function createLocalization(
    apiId: string,
    documentId: string,
    locale: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    let entry: { data?: StrapiEntry }
    try {
      entry = await request(`${apiId}/${documentId}?locale=en`) as { data?: StrapiEntry }
    } catch {
      entry = await request(`${apiId}/${documentId}`) as { data?: StrapiEntry }
    }

    if (!entry || !entry.data) {
      throw new Error(`Base entry not found with documentId: ${documentId}`)
    }

    const { locale: _dataLocale, ...dataWithoutLocale } = data

    const endpoint = `${apiId}/${documentId}?locale=${locale}`
    const result = await request(endpoint, {
      method: 'PUT',
      body: JSON.stringify({
        data: dataWithoutLocale
      })
    }) as { data?: StrapiEntry }

    if (!result || !result.data) {
      throw new Error(
        `Failed to create localization. Response: ${JSON.stringify(result)}`
      )
    }

    const createdEntry = result.data
    const actualLocale = createdEntry.locale
    const actualDocId = createdEntry.documentId

    if (actualLocale !== locale) {
      console.warn(
        `   ⚠️  Created entry has locale '${actualLocale}' but expected '${locale}'`
      )
    }

    if (actualDocId !== documentId) {
      console.warn(
        `   ⚠️  DocumentId mismatch: expected '${documentId}', got '${actualDocId}'`
      )
    }

    return result
  }

  async function updateLocalization(
    apiId: string,
    documentId: string,
    locale: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    const localization = await findBySlug(apiId, data.slug as string, locale)
    const { locale: _dataLocale, ...dataWithoutLocale } = data

    if (localization) {
      const result = await updateEntry(
        apiId,
        localization.documentId,
        dataWithoutLocale,
        locale
      )
      return result
    }
    return await createLocalization(apiId, documentId, locale, data)
  }

  async function createEntry(
    apiId: string,
    data: Record<string, unknown>,
    locale: string | null = null
  ): Promise<{ data: StrapiEntry }> {
    const endpoint = locale ? `${apiId}?locale=${locale}` : apiId
    return await request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ data })
    }) as { data: StrapiEntry }
  }

  async function updateEntry(
    apiId: string,
    documentId: string,
    data: Record<string, unknown>,
    locale: string | null = null
  ): Promise<{ data: StrapiEntry }> {
    const endpoint = locale
      ? `${apiId}/${documentId}?locale=${locale}`
      : `${apiId}/${documentId}`
    return await request(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ data })
    }) as { data: StrapiEntry }
  }

  async function deleteEntry(apiId: string, documentId: string): Promise<unknown> {
    return await request(`${apiId}/${documentId}`, {
      method: 'DELETE'
    })
  }

  /** Delete a single locale variant. Keeps other locales. */
  async function deleteLocalization(
    apiId: string,
    documentId: string,
    locale: string
  ): Promise<unknown> {
    return await request(`${apiId}/${documentId}?locale=${locale}`, {
      method: 'DELETE'
    })
  }

  return {
    request,
    getAllEntries,
    findBySlug,
    createLocalization,
    updateLocalization,
    createEntry,
    updateEntry,
    deleteEntry,
    deleteLocalization
  }
}
