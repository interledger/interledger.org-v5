#!/usr/bin/env node

/**
 * Migrate blog post MDX files from raw markdown to <Paragraph>-wrapped components.
 *
 * For each blog post:
 *   1. Read the MDX file, split frontmatter and body
 *   2. Parse the body with parseMdxToBlocks() → structured blocks
 *   3. Serialize blocks with serializeContent() → <Paragraph>-wrapped MDX
 *   4. Write frontmatter + new body back to the file
 *
 * Usage (from repo root):
 *   pnpm --dir cms tsx scripts/migrate-blog-to-components.ts [--dry-run]
 *
 * INTORG-524
 */

import fs from 'fs'
import path from 'path'

// Side-effect imports: register component handlers
import './sync-mdx/paragraphHandler'
import './sync-mdx/videoEmbedHandler'
import './sync-mdx/blockquoteHandler'
import './sync-mdx/calloutTextHandler'
import './sync-mdx/pdfEmbedHandler'
import './sync-mdx/ambassadorHandler'

import { parseMdxToBlocks, type ParserContext } from './sync-mdx/mdxBlockParser'
import { serializeContent } from '../src/serializers/blocks/index'

/**
 * Split an MDX file into its raw frontmatter header (including `---` delimiters
 * and trailing newline) and the body. Preserves frontmatter byte-for-byte.
 */
function splitFrontmatterAndBody(raw: string): {
  header: string
  body: string
} {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)
  if (!match) {
    return { header: '', body: raw }
  }
  return { header: match[0], body: raw.slice(match[0].length) }
}

const DRY_RUN = process.argv.includes('--dry-run')

const BLOG_DIR = path.resolve(
  __dirname,
  '../../src/content/foundation-blog-posts'
)

const ctx: ParserContext = { locale: 'en' }

async function main() {
  console.log('📝 Blog MDX → Component Format Migration')
  console.log('='.repeat(50))
  if (DRY_RUN) {
    console.log('🔍 DRY-RUN MODE — no files will be written\n')
  }

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .sort()

  console.log(`Found ${files.length} blog post files\n`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const file of files) {
    const filepath = path.join(BLOG_DIR, file)
    const raw = fs.readFileSync(filepath, 'utf-8')
    const { header, body: rawBody } = splitFrontmatterAndBody(raw)
    const body = rawBody.trim()

    if (!body) {
      console.log(`   ⏭️  ${file} — empty body, skipping`)
      skipped++
      continue
    }

    try {
      const blocks = await parseMdxToBlocks(body, { ...ctx, sourceText: body })

      if (blocks.length === 0) {
        console.log(`   ⏭️  ${file} — no blocks produced, skipping`)
        skipped++
        continue
      }

      const serialized = serializeContent(blocks)

      // Rebuild: original frontmatter (byte-for-byte) + blank line + serialized body
      const newContent = header + '\n' + serialized + '\n'

      if (DRY_RUN) {
        console.log(`   🔍 ${file} — ${blocks.length} block(s), would rewrite`)
      } else {
        fs.writeFileSync(filepath, newContent, 'utf-8')
        console.log(`   ✅ ${file} — ${blocks.length} block(s), migrated`)
      }

      migrated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ❌ ${file} — ${msg}`)
      errors++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Summary')
  console.log('='.repeat(50))
  console.log(`   ✅ Migrated: ${migrated}`)
  console.log(`   ⏭️  Skipped:  ${skipped}`)
  console.log(`   ❌ Errors:   ${errors}`)

  if (DRY_RUN) {
    console.log(
      '\n💡 This was a dry-run. Run without --dry-run to apply changes.'
    )
  }

  process.exit(errors ? 1 : 0)
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  process.exit(1)
})
