/**
 * Build-time guardrail: fails the build when an optimizable image is served
 * raw, bypassing the Netlify Image CDN.
 *
 * Source-level linting can't catch this — components often pass a dynamic
 * `src` (e.g. a blog hero's `frontmatter.featureImage`), so there's no literal
 * path to match. The only reliable signal is the rendered HTML, so this audits
 * `dist/**\/*.html` in `astro:build:done`.
 *
 * An image passes when it is delivered through the CDN: either the `<img>` src
 * is already a `/.netlify/images` URL, or it sits inside a `<picture>` whose
 * `<source>` points there. A raw `/img/**` or `/uploads/**` raster with neither
 * is a violation. Escape hatch: `data-allow-unoptimized` on the `<img>`.
 */
import type { AstroIntegration } from 'astro'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isImageCdnEnabled } from '../utils/main/imageCdn'

const CDN_MARKER = '/.netlify/images'
const IMG_TAG_RE = /<img\b[^>]*>/gi
const PICTURE_BLOCK_RE = /<picture\b[^>]*>[\s\S]*?<\/picture>/gi
const CDN_SOURCE_RE =
  /<source\b[^>]*\ssrcset\s*=\s*["'][^"']*\/\.netlify\/images/i

export type ImageAuditReason =
  | 'standalone-raw'
  | 'picture-without-cdn'
  | 'degraded-marker'

export interface ImageAuditViolation {
  src: string
  reason: ImageAuditReason
}

function getAttr(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  )
  return match ? match[1] : null
}

function hasAttr(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(\\s|=|>|/)`, 'i').test(tag)
}

function stripQuery(src: string): string {
  const q = src.indexOf('?')
  return q === -1 ? src : src.slice(0, q)
}

/** A site-relative raster we expect to be optimized (not an SVG/GIF/external). */
export function isOptimizableRasterPath(src: string): boolean {
  if (!src.startsWith('/img/') && !src.startsWith('/uploads/')) return false
  if (src.startsWith('/img/optimized/')) return false
  return /\.(png|jpe?g|webp|avif)$/i.test(stripQuery(src))
}

/** Classifies a single `<img>` tag, or `null` when it is fine. */
function auditImgTag(tag: string): ImageAuditViolation | null {
  if (hasAttr(tag, 'data-allow-unoptimized')) return null

  const degraded = getAttr(tag, 'data-unoptimized-src')
  if (degraded !== null) {
    return {
      src: degraded || getAttr(tag, 'src') || '',
      reason: 'degraded-marker'
    }
  }

  const src = getAttr(tag, 'src')
  if (!src || src.includes(CDN_MARKER)) return null
  if (!isOptimizableRasterPath(src)) return null
  return { src, reason: 'standalone-raw' }
}

/**
 * Finds `<img>` tags in a document that serve an optimizable raster raw.
 * `<picture>` blocks are handled first so an `<img>` fallback inside a
 * CDN-backed `<picture>` is not mistaken for a standalone raw image.
 */
export function findUnoptimizedImages(html: string): ImageAuditViolation[] {
  const violations: ImageAuditViolation[] = []

  const withoutPictures = html.replace(PICTURE_BLOCK_RE, (block) => {
    const cdnBacked = CDN_SOURCE_RE.test(block)
    for (const imgTag of block.match(IMG_TAG_RE) ?? []) {
      const found = auditImgTag(imgTag)
      if (!found) continue
      if (found.reason === 'degraded-marker' || !cdnBacked) {
        violations.push(
          cdnBacked ? found : { ...found, reason: 'picture-without-cdn' }
        )
      }
    }
    return ''
  })

  for (const imgTag of withoutPictures.match(IMG_TAG_RE) ?? []) {
    const found = auditImgTag(imgTag)
    if (found) violations.push(found)
  }

  return violations
}

async function collectHtmlFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await collectHtmlFiles(full)))
    } else if (entry.name.endsWith('.html')) {
      out.push(full)
    }
  }
  return out
}

const REASON_LABEL: Record<ImageAuditReason, string> = {
  'standalone-raw': 'raw <img> with no <picture>',
  'picture-without-cdn': '<picture> without a /.netlify/images <source>',
  'degraded-marker': 'degraded to unoptimized original'
}

const MAX_REPORTED = 25

export function auditImageOptimization(): AstroIntegration {
  return {
    name: 'audit-image-optimization',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        // Only meaningful for what Netlify ships: CDN mode delivers via
        // /.netlify/images. A non-CDN local build uses /img/optimized/* paths
        // and would misfire here.
        if (!isImageCdnEnabled()) {
          logger.info('CDN off — skipping image optimization audit.')
          return
        }

        const distDir = fileURLToPath(dir)
        const files = await collectHtmlFiles(distDir)

        // One entry per distinct src, with a sample page and occurrence count.
        const bySrc = new Map<
          string,
          { reason: ImageAuditReason; file: string; count: number }
        >()

        for (const file of files) {
          const html = await readFile(file, 'utf8')
          for (const { src, reason } of findUnoptimizedImages(html)) {
            const existing = bySrc.get(src)
            if (existing) {
              existing.count += 1
            } else {
              bySrc.set(src, {
                reason,
                file: path.relative(distDir, file),
                count: 1
              })
            }
          }
        }

        if (bySrc.size === 0) {
          logger.info('All optimizable images are served via the CDN.')
          return
        }

        const entries = [...bySrc.entries()]
        const lines = entries
          .slice(0, MAX_REPORTED)
          .map(
            ([src, { reason, file, count }]) =>
              `  - ${src} (${REASON_LABEL[reason]}, ${count} page(s), e.g. ${file})`
          )
        const overflow =
          entries.length > MAX_REPORTED
            ? `\n  …and ${entries.length - MAX_REPORTED} more`
            : ''

        throw new Error(
          `Image optimization audit failed: ${entries.length} image(s) bypass the Netlify Image CDN.\n` +
            `Route these through OptimizedImage/getOptimizedImage, or mark deliberate exceptions with data-allow-unoptimized.\n` +
            lines.join('\n') +
            overflow
        )
      }
    }
  }
}
