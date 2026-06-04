#!/usr/bin/env node

/**
 * One-time frontmatter migration for the reshaped blog template (INTORG-765):
 *   - remove the legacy `pillar` field
 *   - rename `tags:` → `categories:`
 *   - add `featured: false` when absent
 *
 * Operates line-by-line on the frontmatter block only, leaving the body and all
 * other frontmatter byte-for-byte unchanged to keep diffs minimal.
 *
 * Usage (from repo root):
 *   pnpm --dir cms tsx scripts/migrate-blog-frontmatter.ts [--dry-run]
 */

import fs from 'fs'
import path from 'path'

const DRY_RUN = process.argv.includes('--dry-run')

const BLOG_DIRS = [
  path.resolve(__dirname, '../../src/content/foundation-blog-posts'),
  path.resolve(__dirname, '../../src/content/foundation-blog-posts/es')
]

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

/** Rewrites the frontmatter block. Returns null when nothing changed. */
function migrateFrontmatter(raw: string): string | null {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) return null

  const body = raw.slice(match[0].length)
  const lines = match[1].split('\n')

  const withoutPillar = lines.filter((line) => !/^pillar:\s*/.test(line))
  const renamed = withoutPillar.map((line) =>
    /^tags:/.test(line) ? line.replace(/^tags:/, 'categories:') : line
  )

  const hasFeatured = renamed.some((line) => /^featured:/.test(line))
  if (!hasFeatured) {
    const anchor = renamed.findIndex((line) => /^pathSlug:/.test(line))
    const insertAt =
      anchor >= 0
        ? anchor + 1
        : Math.max(renamed.findIndex((line) => /^date:/.test(line)) + 1, 0)
    renamed.splice(insertAt, 0, 'featured: false')
  }

  const newYaml = renamed.join('\n')
  if (newYaml === match[1]) return null
  return `---\n${newYaml}\n---\n${body}`
}

function listMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort()
}

function main() {
  console.log(
    '📝 Blog frontmatter migration (pillar→drop, tags→categories, +featured)'
  )
  console.log('='.repeat(60))
  if (DRY_RUN) console.log('🔍 DRY-RUN MODE — no files will be written\n')

  let changed = 0
  let unchanged = 0

  for (const dir of BLOG_DIRS) {
    for (const filepath of listMdxFiles(dir)) {
      const raw = fs.readFileSync(filepath, 'utf-8')
      const migrated = migrateFrontmatter(raw)
      const name = path.relative(process.cwd(), filepath)

      if (migrated === null) {
        unchanged++
        continue
      }

      if (DRY_RUN) {
        console.log(`   🔍 ${name} — would rewrite frontmatter`)
      } else {
        fs.writeFileSync(filepath, migrated, 'utf-8')
        console.log(`   ✅ ${name}`)
      }
      changed++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`   ✅ Changed:   ${changed}`)
  console.log(`   ⏭️  Unchanged: ${unchanged}`)
  if (DRY_RUN) {
    console.log(
      '\n💡 This was a dry-run. Run without --dry-run to apply changes.'
    )
  }
}

main()
