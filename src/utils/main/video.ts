const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be'
])

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])

export function detectVideoProvider(url: string): 'youtube' | 'vimeo' | null {
  try {
    const { hostname } = new URL(url)
    if (YOUTUBE_HOSTS.has(hostname)) return 'youtube'
    if (VIMEO_HOSTS.has(hostname)) return 'vimeo'
    return null
  } catch {
    return null
  }
}
