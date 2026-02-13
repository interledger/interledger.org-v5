export async function fetchStrapi(endpoint: string) {
  const base = import.meta.env.STRAPI_URL
  const token = import.meta.env.STRAPI_API_TOKEN

  if (!base || !token) {
    return null
  }

  try {
    // Ensure no double slashes
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${base.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!res.ok) {
      return null
    }

    return res.json()
  } catch {
    // Strapi not available - return null to allow fallback
    return null
  }
}
