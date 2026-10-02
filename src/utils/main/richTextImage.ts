import { isSafeMarkdownHref } from '../shared/url'
import {
  buildImageSrcset,
  getOptimizedImage,
  isOptimizableSource,
  type OptimizedImage
} from './images'
import { escapeHtml } from './umami'

export interface RichTextImage {
  src: string
  alt: string
  title?: string | null
}

/** Rich text spans the content column, so the image is never wider. */
const RICH_TEXT_IMAGE_SIZES = '100vw'

function renderAttrs(attrs: Record<string, string | undefined>): string {
  return Object.entries(attrs)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join('')
}

function renderSource(attrs: Record<string, string | undefined>): string {
  return `<source${renderAttrs(attrs)}>`
}

function renderPictureSources(image: OptimizedImage): string {
  const { variants, fullSrc, avifVariants, avifFullSrc } = image
  if (variants.length > 0) {
    return [
      avifVariants.length > 0 &&
        renderSource({
          type: 'image/avif',
          srcset: buildImageSrcset(avifVariants),
          sizes: RICH_TEXT_IMAGE_SIZES
        }),
      renderSource({
        type: 'image/webp',
        srcset: buildImageSrcset(variants),
        sizes: RICH_TEXT_IMAGE_SIZES
      })
    ]
      .filter(Boolean)
      .join('')
  }
  if (!fullSrc) return ''
  return [
    avifFullSrc && renderSource({ type: 'image/avif', srcset: avifFullSrc }),
    renderSource({ type: 'image/webp', srcset: fullSrc })
  ]
    .filter(Boolean)
    .join('')
}

/**
 * HTML for an image in rich text rendered as a string (Marked → `set:html`),
 * routed through the image optimizer like every other image.
 *
 * Mirrors the three branches of `OptimizedImage.astro`, which handles the same
 * images in MDX bodies (`RICH_TEXT_MDX_COMPONENTS`); keep the two in step. With
 * nothing to optimize, the `<img>` carries `data-unoptimized-src` when the
 * source was eligible, so the build audit reports it as a degraded image rather
 * than failing the build on a bypassed optimizer.
 *
 * A source with an unsafe scheme (`javascript:`, `data:`) renders its alt text
 * only, the same way a link with one renders its text.
 */
export function renderOptimizedImageHtml({
  src,
  alt,
  title
}: RichTextImage): string {
  if (!src || !isSafeMarkdownHref(src)) return escapeHtml(alt)

  const sources = renderPictureSources(getOptimizedImage(src))
  const img = `<img${renderAttrs({
    src,
    alt,
    title: title || undefined,
    loading: 'lazy',
    decoding: 'async',
    'data-unoptimized-src':
      !sources && isOptimizableSource(src) ? src : undefined
  })}>`
  return `<picture>${sources}${img}</picture>`
}
