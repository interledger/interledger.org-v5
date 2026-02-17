export interface StrapiEntry {
  documentId: string
  slug: string
  locale?: string
  [key: string]: unknown
}

export interface StrapiClient {
  request: (endpoint: string, options?: RequestInit) => Promise<unknown>
  getAllEntries: (apiId: string, locale?: string) => Promise<StrapiEntry[]>
  findBySlug: (
    apiId: string,
    slug: string,
    locale?: string
  ) => Promise<StrapiEntry | undefined>
  createLocalization: (
    apiId: string,
    documentId: string,
    locale: string,
    data: Record<string, unknown>
  ) => Promise<unknown>
  updateLocalization: (
    apiId: string,
    documentId: string,
    locale: string,
    data: Record<string, unknown>
  ) => Promise<unknown>
  createEntry: (
    apiId: string,
    data: Record<string, unknown>,
    locale?: string
  ) => Promise<{ data: StrapiEntry }>
  updateEntry: (
    apiId: string,
    documentId: string,
    data: Record<string, unknown>,
    locale?: string
  ) => Promise<{ data: StrapiEntry }>
  deleteEntry: (apiId: string, documentId: string) => Promise<unknown>
  deleteLocalization: (
    apiId: string,
    documentId: string,
    locale: string
  ) => Promise<unknown>
}

interface StrapiClientOptions {
  baseUrl: string
  token: string
}

export function createStrapiClient({
  baseUrl,
  token
}: StrapiClientOptions): StrapiClient {
  async function request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<unknown> {
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
    if (!text) {
      throw new Error(`Empty response from Strapi API: ${url}`)
    }

    try {
      return JSON.parse(text)
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response from Strapi API: ${url} - ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async function getAllEntries(
    apiId: string,
    locale = 'all'
  ): Promise<StrapiEntry[]> {
    const localeParam =
      locale === 'all' ? 'locale=all' : locale ? `locale=${locale}` : ''
    const paginationParam = 'pagination[limit]=-1' // -1 disables pagination, returns all entries
    const endpoint = `${apiId}?${paginationParam}${localeParam ? `&${localeParam}` : ''}`

    const data = (await request(endpoint)) as { data: StrapiEntry[] }
    return data.data || []
  }

  async function findBySlug(
    apiId: string,
    slug: string,
    locale?: string
  ): Promise<StrapiEntry | undefined> {
    let endpoint = `${apiId}?filters[slug][$eq]=${slug}`
    if (locale) {
      endpoint += `&locale=${locale}`
    }
    const data = (await request(endpoint)) as { data: StrapiEntry[] }
    return data.data?.[0]
  }

  async function createLocalization(
    apiId: string,
    documentId: string,
    locale: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    // Verify base entry exists
    const entry = (await request(`${apiId}/${documentId}`)) as {
      data?: StrapiEntry
    }

    if (!entry?.data) {
      throw new Error(`Base entry not found with documentId: ${documentId}`)
    }

    // Create localization by updating with locale in query param
    const endpoint = `${apiId}/${documentId}?locale=${locale}`
    return await request(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ data })
    })
  }

  async function updateLocalization(
    apiId: string,
    documentId: string,
    locale: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    const localization = await findBySlug(apiId, data.slug as string, locale)

    if (localization) {
      return await updateEntry(apiId, localization.documentId, data, locale)
    }
    return await createLocalization(apiId, documentId, locale, data)
  }

  async function createEntry(
    apiId: string,
    data: Record<string, unknown>,
    locale?: string
  ): Promise<{ data: StrapiEntry }> {
    const endpoint = locale ? `${apiId}?locale=${locale}` : apiId
    return (await request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ data })
    })) as { data: StrapiEntry }
  }

  async function updateEntry(
    apiId: string,
    documentId: string,
    data: Record<string, unknown>,
    locale?: string
  ): Promise<{ data: StrapiEntry }> {
    const endpoint = locale
      ? `${apiId}/${documentId}?locale=${locale}`
      : `${apiId}/${documentId}`
    return (await request(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ data })
    })) as { data: StrapiEntry }
  }

  async function deleteEntry(
    apiId: string,
    documentId: string
  ): Promise<unknown> {
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
