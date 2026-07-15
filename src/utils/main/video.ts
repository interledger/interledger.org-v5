const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be'
])

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])

const VIDEO_FILE_EXT = /\.(mp4|webm|ogg|ogv|mov)(\?.*)?(#.*)?$/i

export function detectVideoProvider(
  url: string
): 'youtube' | 'vimeo' | 'file' | null {
  // Direct video files (local uploads or any direct URL) play inline via <video>.
  // Checked first so relative paths like /img/.../clip.mp4 (which `new URL` can't
  // parse without a base) are still recognized.
  if (VIDEO_FILE_EXT.test(url)) return 'file'
  try {
    const { hostname } = new URL(url)
    if (YOUTUBE_HOSTS.has(hostname)) return 'youtube'
    if (VIMEO_HOSTS.has(hostname)) return 'vimeo'
    return null
  } catch {
    return null
  }
}
