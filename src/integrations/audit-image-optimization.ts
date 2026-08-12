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
 * `<source>` points there. Escape hatch: `data-allow-unoptimized` on the tag.
 *
 * Four carriers are checked: `<img>`, `<picture>`, inline
 * `style="background-image:url(…)"`, and `poster`. The latter two bypass `<img>`
 * entirely and so are invisible to every other check — that is how a 60KB
 * homepage poster sat unoptimized while this reported clean.
 *
 * Known blind spots, deliberately not covered: `url()` inside emitted CSS files
 * (no instances today, and no per-rule escape hatch would exist), `<meta
 * og:image>` (consumed by crawlers, not browsers), and anything rendered by an
 * SSR route, which never produces a file in `dist`. The success message names
 * what was actually checked so a clean run cannot be read as a whole-site
 * guarantee.
 *
 * Findings come in two severities, and the split is the point of this audit:
 *
 * - **Blocking** (`standalone-raw`, `picture-without-cdn`): a raw `/img/**` or
 *   `/uploads/**` raster reached the page without going through
 *   `OptimizedImage`/`getOptimizedImage` at all. That is a code defect, it is
 *   deterministic from the repo tree, and whoever wrote the component can fix
 *   it — so it fails the build.
 * - **Reported only** (`degraded-marker`): the component *did* route through
 *   `getOptimizedImage`, which found the source missing from this deploy and
 *   deliberately emitted a plain `<img>` rather than a `<picture>` a browser
 *   cannot fall back from. That is the designed degrade path working, and its
 *   cause is deploy/content state rather than code, so it is logged instead.
 *
 * A degraded marker still usually means a broken image (in CDN mode the catalog
 * is the set of sources present in the deploy, so a miss means the raw `<img>`
 * 404s too), but it is a poor instrument for catching that: it is blind to SVGs
 * and GIFs, and only sees references that survive into prerendered HTML.
 * Reference integrity belongs in a dedicated content check, not here.
 */
import type { AstroIntegration } from 'astro'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isImageCdnEnabled } from '../utils/main/imageCdn'
import { hasOptimizableRasterExtension } from '../utils/main/imagePaths'

const CDN_MARKER = '/.netlify/images'
const IMG_TAG_RE = /<img\b[^>]*>/gi
const PICTURE_BLOCK_RE = /<picture\b[^>]*>[\s\S]*?<\/picture>/gi
const CDN_SOURCE_RE =
  /<source\b[^>]*\ssrcset\s*=\s*["'][^"']*\/\.netlify\/images/i
const OPEN_TAG_RE = /<[a-z][a-z0-9-]*\b[^>]*>/gi
const CSS_URL_RE = /url\(([^)]*)\)/gi

export type ImageAuditReason =
  | 'standalone-raw'
  | 'picture-without-cdn'
  | 'degraded-marker'
  | 'raw-css-background'
  | 'raw-poster'

export interface ImageAuditFinding {
  src: string
  reason: ImageAuditReason
}

/**
 * Reasons that fail the build: both mean a component bypassed
 * `OptimizedImage`/`getOptimizedImage`. `degraded-marker` is deliberately
 * absent — see the module comment.
 */
const BLOCKING_REASONS: ReadonlySet<ImageAuditReason> = new Set([
  'standalone-raw',
  'picture-without-cdn',
  'raw-css-background',
  'raw-poster'
])

export function isBlockingAuditReason(reason: ImageAuditReason): boolean {
  return BLOCKING_REASONS.has(reason)
}

/**
 * Reads an attribute, keyed on whichever quote opened it. A `style` value
 * routinely nests the other quote character — `style="…url('/img/a.png')"` —
 * and a naive `["'][^"']*["']` stops dead at that inner quote.
 */
function getAttr(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  )
  if (!match) return null
  return match[1] ?? match[2] ?? null
}

function hasAttr(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(\\s|=|>|/)`, 'i').test(tag)
}

/** A site-relative raster we expect to be optimized (not an SVG/GIF/external). */
export function isOptimizableRasterPath(src: string): boolean {
  if (!src.startsWith('/img/') && !src.startsWith('/uploads/')) return false
  if (src.startsWith('/img/optimized/')) return false
  return hasOptimizableRasterExtension(src)
}

/** Strips the optional quoting from a `url(…)` value, entities included. */
function unwrapCssUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:['"]|&#39;|&quot;)/, '')
    .replace(/(?:['"]|&#39;|&quot;)$/, '')
    .trim()
}

/**
 * Findings from a tag's attributes rather than its `src`: inline
 * `style="background-image:url(…)"` and `<video poster>`. Neither can carry a
 * srcset, so the fix is a single CDN URL (see `getHeroSectionStyle` and
 * `VideoEmbed`) — but both bypass `<img>` entirely, so nothing else sees them.
 */
function auditTagAttributes(tag: string): ImageAuditFinding[] {
  if (hasAttr(tag, 'data-allow-unoptimized')) return []

  const findings: ImageAuditFinding[] = []
  const flag = (src: string, reason: ImageAuditReason): void => {
    if (src.includes(CDN_MARKER)) return
    if (!isOptimizableRasterPath(src)) return
    findings.push({ src, reason })
  }

  const style = getAttr(tag, 'style')
  if (style) {
    for (const [, rawUrl] of style.matchAll(CSS_URL_RE)) {
      flag(unwrapCssUrl(rawUrl), 'raw-css-background')
    }
  }

  const poster = getAttr(tag, 'poster')
  if (poster) flag(poster, 'raw-poster')

  return findings
}

/** Classifies a single `<img>` tag, or `null` when it is fine. */
function auditImgTag(tag: string): ImageAuditFinding | null {
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
export function findUnoptimizedImages(html: string): ImageAuditFinding[] {
  const findings: ImageAuditFinding[] = []

  const withoutPictures = html.replace(PICTURE_BLOCK_RE, (block) => {
    const cdnBacked = CDN_SOURCE_RE.test(block)
    for (const imgTag of block.match(IMG_TAG_RE) ?? []) {
      const found = auditImgTag(imgTag)
      if (!found) continue

      // A degrade marker already explains the missing <source>: OptimizedImage
      // wraps its fallback branch in a source-less <picture> so `pictureClass`
      // still applies. Reclassifying that as a component bypass would report
      // the designed fallback as a code defect — and, since the wrapper is
      // emitted on every degrade, would do so every time.
      if (found.reason === 'degraded-marker') {
        findings.push(found)
        continue
      }

      if (!cdnBacked) findings.push({ ...found, reason: 'picture-without-cdn' })
    }
    return ''
  })

  for (const imgTag of withoutPictures.match(IMG_TAG_RE) ?? []) {
    const found = auditImgTag(imgTag)
    if (found) findings.push(found)
  }

  // Attribute-borne images are found on the original document: they can sit on
  // any tag, including one inside a <picture>, and they never overlap with the
  // `src` findings above.
  for (const tag of html.match(OPEN_TAG_RE) ?? []) {
    findings.push(...auditTagAttributes(tag))
  }

  return findings
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
  'degraded-marker': 'degraded to unoptimized original',
  'raw-css-background': 'raw url() in an inline style',
  'raw-poster': 'raw poster attribute'
}

const MAX_REPORTED = 25

interface AuditEntry {
  reason: ImageAuditReason
  file: string
  count: number
}

/** One line per distinct src, truncated to `MAX_REPORTED` with an overflow note. */
function formatEntries(entries: Array<[string, AuditEntry]>): string {
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
  return lines.join('\n') + overflow
}

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

        // A guardrail that scanned nothing would report a clean build it never
        // looked at, and the failure is silent precisely when it matters — a
        // changed output layout, or a `dir` that no longer points at the pages.
        // This build prerenders well over a thousand pages, so zero is broken.
        if (files.length === 0) {
          throw new Error(
            `Image optimization audit found no HTML to scan under ${distDir}.\n` +
              `The audit cannot vouch for a build it never read — check the build output layout.`
          )
        }

        // One entry per distinct src, with a sample page and occurrence count.
        const bySrc = new Map<string, AuditEntry>()

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

        // State the coverage alongside the verdict. A bare all-clear reads as a
        // whole-site guarantee, which this cannot give: it sees prerendered HTML
        // only, and within it only the four carriers named here.
        const scanned = `${files.length} HTML file(s) scanned (<img>, <picture>, inline background, poster)`

        if (bySrc.size === 0) {
          logger.info(`${scanned} — none bypassed the CDN.`)
          return
        }

        const entries = [...bySrc.entries()]
        const blocking = entries.filter(([, e]) =>
          isBlockingAuditReason(e.reason)
        )
        const degraded = entries.filter(
          ([, e]) => !isBlockingAuditReason(e.reason)
        )

        if (degraded.length > 0) {
          logger.warn(
            `${degraded.length} image(s) degraded to the unoptimized original — ` +
              `the source is not present in this deploy, so getOptimizedImage emitted a plain <img>.\n` +
              formatEntries(degraded)
          )
        }

        if (blocking.length === 0) {
          logger.info(`${scanned} — none bypassed the CDN.`)
          return
        }

        throw new Error(
          `Image optimization audit failed: ${blocking.length} image(s) bypass the Netlify Image CDN.\n` +
            `Route these through OptimizedImage/getOptimizedImage, or mark deliberate exceptions with data-allow-unoptimized.\n` +
            formatEntries(blocking)
        )
      }
    }
  }
}
