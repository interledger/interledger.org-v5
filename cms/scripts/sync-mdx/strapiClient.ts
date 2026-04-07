export interface StrapiEntry {
  documentId: string
  pathSlug: string
  locale?: string
  [key: string]: unknown
}

export interface StrapiClient {
  request: (endpoint: string, options?: RequestInit) => Promise<unknown>
  getAllEntries: (apiId: string, locale?: string) => Promise<StrapiEntry[]>
  findByPathSlug: (
    apiId: string,
    pathSlug: string,
    locale?: string
  ) => Promise<StrapiEntry | undefined>
  /** Look up a Strapi upload file by URL. Returns the file's integer ID, or null. */
  findUploadByUrl: (url: string) => Promise<number | null>
  /** Update the alternativeText (alt text) on a Strapi upload file record. */
  updateUploadAlt: (id: number, alternativeText: string) => Promise<void>
  findUploadByName: (name: string) => Promise<number | null>
  /** Remove a media library file by numeric id (also deletes files on disk via upload provider). */
  deleteUploadFile: (id: number) => Promise<void>
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
  const apiRoot = `${baseUrl.replace(/\/+$/, '')}/api`

  async function request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const url = `${apiRoot}/${endpoint.replace(/^\/+/, '')}`
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
      // 204 No Content is a valid success response (e.g. DELETE operations)
      return null
    }

    try {
      return JSON.parse(text)
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response from Strapi API: ${url} - ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      )
    }
  }

  /** Strapi 5 defaults to pageSize 25; `pagination[limit]=-1` is not reliable. Page until done. */
  async function getAllEntries(
    apiId: string,
    locale = 'all'
  ): Promise<StrapiEntry[]> {
    const localeParam =
      locale === 'all' ? 'locale=all' : locale ? `locale=${locale}` : ''
    const PAGE_SIZE = 100
    const out: StrapiEntry[] = []
    let page = 1
    const maxPages = 500

    for (;;) {
      const qs = [
        `pagination[page]=${page}`,
        `pagination[pageSize]=${PAGE_SIZE}`,
        localeParam
      ]
        .filter(Boolean)
        .join('&')
      const endpoint = `${apiId}?${qs}`

      const res = (await request(endpoint)) as {
        data?: StrapiEntry[]
        meta?: {
          pagination?: { page?: number; pageCount?: number; pageSize?: number }
        }
      }
      const batch = res.data ?? []
      out.push(...batch)

      const pageCount = res.meta?.pagination?.pageCount
      if (batch.length === 0) break
      if (pageCount != null && page >= pageCount) break
      if (batch.length < PAGE_SIZE) break
      page += 1
      if (page > maxPages) {
        throw new Error(
          `getAllEntries(${apiId}): exceeded ${maxPages} pages — refine query or raise limit`
        )
      }
    }

    return out
  }

  async function findByPathSlug(
    apiId: string,
    pathSlug: string,
    locale?: string
  ): Promise<StrapiEntry | undefined> {
    let endpoint = `${apiId}?filters[pathSlug][$eq]=${pathSlug}`
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
    const pathSlug = data.pathSlug as string
    const localization = await findByPathSlug(apiId, pathSlug, locale)

    if (localization) {
      // In Strapi v5, linked locales share the same documentId. If the found
      // entry has a different documentId, it's an orphan (created standalone)
      // and won't show in "AVAILABLE IN". Delete and recreate to properly link.
      if (localization.documentId !== documentId) {
        await deleteLocalization(apiId, localization.documentId, locale)
        return await createLocalization(apiId, documentId, locale, data)
      }
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

  async function updateUploadAlt(
    id: number,
    alternativeText: string
  ): Promise<void> {
    const formData = new FormData()
    formData.append('fileInfo', JSON.stringify({ alternativeText }))

    const url = `${apiRoot}/upload?id=${id}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-skip-mdx-export': 'true'
      },
      body: formData
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Strapi API error (${response.status}): ${text}`)
    }
  }

  /** Delete a single locale variant. Keeps other locales. */
  async function findUploadByUrl(url: string): Promise<number | null> {
    if (!url || url === 'null') return null

    // For CDN URLs, extract just the path portion (e.g. /uploads/photo.webp)
    let lookupUrl = url
    if (url.startsWith('http')) {
      try {
        lookupUrl = new URL(url).pathname
      } catch {
        // Not a valid absolute URL — use as-is
      }
    }

    const result = await request(
      `upload/files?filters[url][$eq]=${encodeURIComponent(lookupUrl)}`
    )
    // Strapi Upload API returns a plain array, not { data: [] }
    const files = Array.isArray(result)
      ? (result as { id: number }[])
      : ((result as { data?: { id: number }[] })?.data ?? [])
    return files.length > 0 ? files[0].id : null
  }

  async function findUploadByName(name: string) {
    const result = await request(
      `upload/files?filters[name][$eq]=${encodeURIComponent(name)}`
    )
    const files = Array.isArray(result)
      ? (result as { id: number }[])
      : ((result as { data?: { id: number }[] })?.data ?? [])

    return files.length > 0 ? files[0].id : null
  }

  async function deleteUploadFile(id: number): Promise<void> {
    const url = `${baseUrl}/api/upload/files/${id}`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-skip-mdx-export': 'true'
      }
    })
    if (!response.ok && response.status !== 404) {
      const text = await response.text()
      throw new Error(`Strapi API error (${response.status}): ${text}`)
    }
  }

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
    findByPathSlug,
    findUploadByUrl,
    updateUploadAlt,
    findUploadByName,
    deleteUploadFile,
    createLocalization,
    updateLocalization,
    createEntry,
    updateEntry,
    deleteEntry,
    deleteLocalization
  }
}
