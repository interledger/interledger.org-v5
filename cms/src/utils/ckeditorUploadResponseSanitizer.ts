/**
 * CKEditor (@_sh/strapi-plugin-ckeditor) builds `srcset` from `formats[].width` + `formats[].url`
 * on the upload XHR response. Our main `url` is under `img/original/` (masters) while
 * Strapi derivatives normally live under `img/optimized/`. If `formats[].url` incorrectly
 * points at `.../original/thumbnail_*` etc., the browser prefers `srcset` → 404 → broken
 * in-editor preview until reload (saved HTML often has no `srcset`).
 *
 * When we detect that mismatch, drop `formats` from this **response body only** so the
 * adapter sends CKEditor `{ default: mainUrl }` and preview uses `src`. Correct optimized
 * `formats` (if ever present) are left intact.
 */
const DERIVATIVE_UNDER_ORIGINAL =
  /\/img\/original\/(thumbnail|small|medium|large|xlarge)_/i

export function sanitizeStrapiImageUploadResponseForCke(body: unknown): void {
  if (!Array.isArray(body) || body.length === 0) return

  for (const item of body) {
    if (!item || typeof item !== 'object') continue
    const file = item as Record<string, unknown>
    const mime = typeof file.mime === 'string' ? file.mime : ''
    const url = typeof file.url === 'string' ? file.url : ''
    if (!mime.startsWith('image/')) continue
    if (!url.includes('/img/original/')) continue
    const formats = file.formats
    if (!formats || typeof formats !== 'object') continue

    const hasBadDerivativeUrl = Object.keys(formats as object).some((key) => {
      const fmt = (formats as Record<string, { url?: string }>)[key]
      const u = typeof fmt?.url === 'string' ? fmt.url : ''
      return u.length > 0 && DERIVATIVE_UNDER_ORIGINAL.test(u)
    })

    if (hasBadDerivativeUrl) {
      delete file.formats
    }
  }
}
