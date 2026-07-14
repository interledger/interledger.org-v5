#!/usr/bin/env node

/**
 * One-time migration that folds the legacy developers/tech blog into the
 * foundation blog (INTORG-691). For each MDX/MD file under
 * `src/content/developers-blog-posts/` (EN) and `.../es/`:
 *
 *   - rewrites frontmatter to satisfy `foundationBlogFrontmatterSchema`:
 *       legacy: true, featured: false, authors/author_urls → articleBios,
 *       tags → categories: ['Engineering'], keeps
 *       title/description/date/pathSlug/locale/localizes, drops
 *       external_url/ogImageUrl/tags
 *   - rewrites body image refs `/img/blog/...` → `/img/foundation-blog/...`
 *     (the dated image dirs move alongside this script run)
 *   - moves the file into `src/content/foundation-blog-posts/` (or `/es`),
 *     normalizing the extension to `.mdx` so it round-trips through the Strapi
 *     exporter (`{date}-{slug}.mdx`)
 *   - prints the old→new URL pairs so the matching 301 redirects can be added
 *
 * Usage (from repo root):
 *   pnpm --dir cms tsx scripts/migrate-dev-blog-to-foundation.ts [--dry-run]
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import yaml from 'js-yaml'

const DRY_RUN = process.argv.includes('--dry-run')

const ROOT = path.resolve(__dirname, '../..')
const SRC_EN = path.join(ROOT, 'src/content/developers-blog-posts')
const SRC_ES = path.join(SRC_EN, 'es')
const DEST_EN = path.join(ROOT, 'src/content/foundation-blog-posts')
const DEST_ES = path.join(DEST_EN, 'es')

/**
 * Every migrated tech post lands in this single category. Comms (Sarah, on the
 * INTORG-691 issue) asked for the dev tags to be dropped and replaced with one
 * "Engineering" category; finer categorization will be added per-post later.
 */
const TECH_CATEGORY = 'Engineering'

interface DevFrontmatter {
  title: string
  description: string
  date: Date | string
  pathSlug: string
  locale?: string
  localizes?: string
  authors?: string[]
  author_urls?: string[]
  tags?: string[]
  external_url?: string
  ogImageUrl?: string
}

interface ArticleBio {
  author: string
  link?: string
}

/** Pairs each author with the URL at the same index, when present. */
function toArticleBios(
  authors: string[] = [],
  urls: string[] = []
): ArticleBio[] {
  return authors.map((author, i) => {
    const link = urls[i]
    return link ? { author, link } : { author }
  })
}

/** YYYY-MM-DD, matching the date style of existing foundation posts. */
function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().slice(0, 10)
}

/** Builds the foundation-schema frontmatter block (without the `---` fences). */
function buildFrontmatter(fm: DevFrontmatter): string {
  const ordered: Record<string, unknown> = {
    title: fm.title,
    description: fm.description,
    date: formatDate(fm.date),
    pathSlug: fm.pathSlug,
    featured: false,
    locale: fm.locale ?? 'en'
  }
  if (fm.localizes) ordered.localizes = fm.localizes
  ordered.articleBios = toArticleBios(fm.authors, fm.author_urls)
  ordered.categories = [TECH_CATEGORY]
  ordered.legacy = true

  const dumped = yaml
    .dump(ordered, { lineWidth: -1, quotingType: "'", forceQuotes: false })
    .trimEnd()

  // js-yaml quotes date-like strings; existing foundation posts use an
  // unquoted `date: YYYY-MM-DD`, so unquote it to keep diffs consistent.
  return dumped.replace(/^date: '(\d{4}-\d{2}-\d{2})'$/m, 'date: $1')
}

/** Repoints dated tech image dirs to the foundation blog image tree. */
function rewriteImageRefs(body: string): string {
  return body.replace(/\/img\/blog\//g, '/img/foundation-blog/')
}

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort()
}

interface RedirectPair {
  from: string
  to: string
}

/** Migrates one file; returns the redirect pair it produced. */
function migrateFile(srcPath: string, destDir: string): RedirectPair {
  const raw = fs.readFileSync(srcPath, 'utf-8')
  const { data, content } = matter(raw)
  const fm = data as DevFrontmatter

  const newFrontmatter = buildFrontmatter(fm)
  const newBody = rewriteImageRefs(content)
  const output = `---\n${newFrontmatter}\n---\n${newBody.replace(/^\n/, '')}`

  const base = path.basename(srcPath).replace(/\.mdx?$/, '.mdx')
  const destPath = path.join(destDir, base)

  if (!DRY_RUN) {
    fs.writeFileSync(destPath, output, 'utf-8')
    fs.rmSync(srcPath)
  }

  const isEs = fm.locale === 'es'
  const prefix = isEs ? '/es' : ''
  return {
    from: `${prefix}/developers/blog/${fm.pathSlug}`,
    to: `${prefix}/blog/${fm.pathSlug}`
  }
}

function main(): void {
  console.log('📝 Dev blog → foundation blog migration (INTORG-691)')
  console.log('='.repeat(60))
  if (DRY_RUN) console.log('🔍 DRY-RUN MODE — no files will be written\n')

  const redirects: RedirectPair[] = []

  for (const [srcDir, destDir] of [
    [SRC_EN, DEST_EN],
    [SRC_ES, DEST_ES]
  ] as const) {
    for (const srcPath of listSourceFiles(srcDir)) {
      const pair = migrateFile(srcPath, destDir)
      redirects.push(pair)
      console.log(
        `   ${DRY_RUN ? '🔍' : '✅'} ${path.relative(ROOT, srcPath)} → ${pair.to}`
      )
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`   Migrated ${redirects.length} post(s)\n`)
  console.log('Redirect entries (add to redirects.ts):')
  for (const { from, to } of redirects) {
    console.log(`  '${from}': '${to}',`)
  }
  if (DRY_RUN) {
    console.log('\n💡 Dry-run. Re-run without --dry-run to apply.')
  }
}

main()
