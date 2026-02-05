function createStrapiClient({ baseUrl, token }) {
  async function request(endpoint, options = {}) {
    const url = `${baseUrl}/api/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Strapi API error (${response.status}): ${text}`);
    }

    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function getAllEntries(apiId, locale = 'all') {
    const allEntries = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const localeParam =
        locale === 'all' ? 'locale=all' : locale ? `locale=${locale}` : '';
      const paginationParam = `pagination[page]=${page}&pagination[pageSize]=100`;
      const endpoint = `${apiId}?${paginationParam}`;
      const finalEndpoint = endpoint + (localeParam ? `&${localeParam}` : '');

      const data = await request(finalEndpoint);
      const entries = data.data || [];
      allEntries.push(...entries);

      const pagination = data.meta?.pagination;
      hasMore = pagination && page < pagination.pageCount;
      page++;
    }

    return allEntries;
  }

  async function findBySlug(apiId, slug, locale = null) {
    let endpoint = `${apiId}?filters[slug][$eq]=${slug}`;
    if (locale) {
      endpoint += `&locale=${locale}`;
    }
    const data = await request(endpoint);
    return data.data && data.data.length > 0 ? data.data[0] : null;
  }

  async function findBySlugInDefaultLocale(apiId, slug) {
    return await findBySlug(apiId, slug, 'en');
  }

  async function createLocalization(apiId, documentId, locale, data) {
    let entry;
    try {
      entry = await request(`${apiId}/${documentId}?locale=en`);
    } catch {
      entry = await request(`${apiId}/${documentId}`);
    }

    if (!entry || !entry.data) {
      throw new Error(`Base entry not found with documentId: ${documentId}`);
    }

    console.log(
      `      📝 Creating localization for documentId=${documentId}, locale=${locale}`
    );

    const { locale: dataLocale, ...dataWithoutLocale } = data;

    const endpoint = `${apiId}/${documentId}?locale=${locale}`;
    console.log(`      🔗 PUT ${endpoint}`);

    const result = await request(endpoint, {
      method: 'PUT',
      body: JSON.stringify({
        data: dataWithoutLocale
      })
    });

    if (!result || !result.data) {
      throw new Error(
        `Failed to create localization. Response: ${JSON.stringify(result)}`
      );
    }

    const createdEntry = result.data;
    const actualLocale = createdEntry.locale;
    const actualDocId = createdEntry.documentId;

    console.log(`      📋 Result: documentId=${actualDocId}, locale=${actualLocale}`);

    if (actualLocale !== locale) {
      console.warn(
        `   ⚠️  Created entry has locale '${actualLocale}' but expected '${locale}'`
      );
    }

    if (actualDocId !== documentId) {
      console.warn(
        `   ⚠️  DocumentId mismatch: expected '${documentId}', got '${actualDocId}'`
      );
    }

    return result;
  }

  async function updateLocalization(apiId, documentId, locale, data) {
    const localization = await findBySlug(apiId, data.slug, locale);
    const { locale: dataLocale, ...dataWithoutLocale } = data;

    if (localization) {
      console.log(
        `      📝 Updating existing localization: documentId=${localization.documentId}, locale=${locale}`
      );
      const result = await updateEntry(
        apiId,
        localization.documentId,
        dataWithoutLocale,
        locale
      );
      console.log(
        `      📋 Update result: documentId=${result?.data?.documentId}, locale=${result?.data?.locale}`
      );
      return result;
    }

    console.log(`      📝 No existing localization found, creating new one`);
    return await createLocalization(apiId, documentId, locale, data);
  }

  async function createEntry(apiId, data, locale = null) {
    const endpoint = locale ? `${apiId}?locale=${locale}` : apiId;
    return await request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ data })
    });
  }

  async function updateEntry(apiId, documentId, data, locale = null) {
    const endpoint = locale
      ? `${apiId}/${documentId}?locale=${locale}`
      : `${apiId}/${documentId}`;
    return await request(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ data })
    });
  }

  async function deleteEntry(apiId, documentId) {
    return await request(`${apiId}/${documentId}`, {
      method: 'DELETE'
    });
  }

  return {
    request,
    getAllEntries,
    findBySlug,
    findBySlugInDefaultLocale,
    createLocalization,
    updateLocalization,
    createEntry,
    updateEntry,
    deleteEntry
  };
}

module.exports = {
  createStrapiClient
};
