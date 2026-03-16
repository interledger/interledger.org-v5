export const CACHE_CONTROL = {
  html: 'public, max-age=0, must-revalidate',
  preview: 'private, no-store, max-age=0, must-revalidate',
  immutableAsset: 'public, max-age=31536000, immutable',
  publicAsset: 'public, max-age=86400, stale-while-revalidate=604800'
} as const

export function applyPreviewNoStore(headers: Headers) {
  headers.set('Cache-Control', CACHE_CONTROL.preview)
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
}
