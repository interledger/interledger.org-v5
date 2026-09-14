#!/usr/bin/env node

/**
 * One-time backfill (INTORG-1157): generates `*Blur` LQIP placeholders for
 * hero/feature images published before that frontmatter field existed.
 * New and edited content already gets this automatically via the Strapi
 * lifecycle hook (`heroFrontmatter` / `generateBlogMDX`) — this script only
 * covers the existing backlog.
 *
 * Operates line-by-line on the frontmatter block only, leaving the body and
 * all other frontmatter byte-for-byte unchanged to keep diffs minimal (same
 * approach as migrate-blog-frontmatter.ts).
 *
 * Usage (from repo root):
 *   pnpm --dir cms tsx scripts/backfill-hero-blur.ts [--dry-run]
 */

import fs from 'fs'
import path from 'path'
import { generateBlurPlaceholder, getProjectRoot, PATHS } from '@/utils'

const DRY_RUN = process.argv.includes('--dry-run')

const CONTENT_ROOT = path.resolve(getProjectRoot(), PATHS.CONTENT_ROOT)

const IMAGE_FIELDS = [
  { source: 'heroImage', blur: 'heroImageBlur' },
  { source: 'heroImageMobile', blur: 'heroImageMobileBlur' },
  { source: 'featureImage', blur: 'featureImageBlur' },
  { source: 'featureImageMobile', blur: 'featureImageMobileBlur' }
] as const

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/
// A handful of legacy-imported MDX files (Drupal-era Spanish blog posts) carry
// a leading UTF-8 BOM before the `---` delimiter, which the anchored regex
// above does not tolerate. Strip it before matching and restore it on write
// so those files don't change encoding as a side effect.
const BOM = String.fromCharCode(0xfeff)

function listMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listMdxFiles(full)
    return entry.isFile() && /\.mdx?$/.test(entry.name) ? [full] : []
  })
}

/** Reads a single-or-double-quoted YAML scalar value off one frontmatter line. */
function extractFieldValue(line: string, field: string): string | null {
  const match = line.match(new RegExp(`^${field}:\\s*(['"])(.*)\\1\\s*$`))
  return match ? match[2] : null
}

// Two locales (or two pages) commonly share the same source image — cache
// within this run so each unique path only gets processed by sharp once.
const blurCache = new Map<string, Promise<string | Error>>()
function cachedGenerateBlurPlaceholder(url: string): Promise<string | Error> {
  const cached = blurCache.get(url)
  if (cached) return cached
  const pending = generateBlurPlaceholder(url)
  blurCache.set(url, pending)
  return pending
}

async function backfillFile(
  filepath: string
): Promise<{ updated: boolean; skipped: string[] }> {
  const rawWithBom = fs.readFileSync(filepath, 'utf-8')
  const hasBom = rawWithBom.startsWith(BOM)
  const raw = hasBom ? rawWithBom.slice(BOM.length) : rawWithBom

  const match = raw.match(FRONTMATTER_RE)
  if (!match) {
    return {
      updated: false,
      skipped: [`${path.basename(filepath)}: no parseable frontmatter block`]
    }
  }

  const body = raw.slice(match[0].length)
  const lines = match[1].split('\n')
  const skipped: string[] = []
  let changed = false

  for (const { source, blur } of IMAGE_FIELDS) {
    const sourceIndex = lines.findIndex((line) => line.startsWith(`${source}:`))
    if (sourceIndex === -1) continue

    const alreadyHasBlur = lines.some((line) => line.startsWith(`${blur}:`))
    if (alreadyHasBlur) continue

    const value = extractFieldValue(lines[sourceIndex]!, source)
    if (!value) continue

    const result = await cachedGenerateBlurPlaceholder(value)
    if (result instanceof Error) {
      skipped.push(`${path.basename(filepath)} (${source}): ${result.message}`)
      continue
    }

    lines.splice(sourceIndex + 1, 0, `${blur}: '${result}'`)
    changed = true
  }

  if (changed && !DRY_RUN) {
    const prefix = hasBom ? BOM : ''
    fs.writeFileSync(
      filepath,
      `${prefix}---\n${lines.join('\n')}\n---\n${body}`,
      'utf-8'
    )
  }

  return { updated: changed, skipped }
}

async function main() {
  const files = listMdxFiles(CONTENT_ROOT)
  let updatedCount = 0
  const allSkipped: string[] = []

  for (const filepath of files) {
    const { updated, skipped } = await backfillFile(filepath)
    if (updated) {
      updatedCount++
      console.log(
        `${DRY_RUN ? '[dry-run] would update' : '✅ updated'}: ${path.relative(CONTENT_ROOT, filepath)}`
      )
    }
    allSkipped.push(...skipped)
  }

  console.log(
    `\n${DRY_RUN ? 'Would update' : 'Updated'} ${updatedCount} of ${files.length} MDX files.`
  )
  if (allSkipped.length > 0) {
    console.log(`\n⚠️  Skipped ${allSkipped.length} image(s):`)
    for (const line of allSkipped) console.log(`  - ${line}`)
  }
}

main()
