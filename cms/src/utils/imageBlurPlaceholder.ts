import sharp from 'sharp'
import { tryCatchAsync } from './tryCatch'
import { isLocalImagePath, resolvePublicImagePath } from './uploadValidation'
import { getProjectRoot } from './paths'
import { stripUploadOrigin } from './relativeLinks'

/** Width of the generated placeholder. Small enough that decode cost and the
 * resulting base64 string are both negligible once inlined into frontmatter. */
const BLUR_WIDTH = 20
const BLUR_WEBP_QUALITY = 40

/**
 * Generates a tiny blurred placeholder for a local `/img/` or `/uploads/`
 * image, as a base64 `data:image/webp` URI suitable for inlining directly
 * into MDX frontmatter (`heroImageBlur`, `featureImageBlur`, etc.).
 *
 * Only handles locally-stored assets — the CMS upload provider is `local`
 * (`cms/config/plugins.ts`) and uploads are git-synced onto disk, so this can
 * read the file directly rather than fetching it. A non-local URL returns an
 * `Error` rather than guessing at a remote resolution.
 *
 * `url` may be an absolute upload URL: `getImageUrl()` (mdx.ts) prepends
 * `STRAPI_UPLOADS_BASE_URL` (.env.example — set when uploads are fronted by
 * an external CDN/domain) to `/uploads/...` paths. The file still lives in
 * this repo's `public/uploads/` regardless of that prefix (uploads are
 * git-synced onto disk — CLAUDE.md), so `stripUploadOrigin` reduces it back
 * to a repo-relative pathname before the local-path check and disk
 * resolution, the same way it already does for CTA links (INTORG-938).
 */
export async function generateBlurPlaceholder(
  url: string
): Promise<string | Error> {
  const localUrl = stripUploadOrigin(url)

  if (!isLocalImagePath(localUrl)) {
    return new Error(
      `Cannot generate blur placeholder for non-local image path: ${url}`
    )
  }

  const resolvedPath = resolvePublicImagePath(getProjectRoot(), localUrl)
  if (resolvedPath instanceof Error) return resolvedPath

  return tryCatchAsync(async () => {
    const buffer = await sharp(resolvedPath)
      .resize(BLUR_WIDTH, null, { fit: 'inside' })
      .webp({ quality: BLUR_WEBP_QUALITY })
      .toBuffer()

    return `data:image/webp;base64,${buffer.toString('base64')}`
  })
}
