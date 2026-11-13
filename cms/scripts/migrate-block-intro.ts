#!/usr/bin/env node

/**
 * Moves block headings into block intros in MDX content (INTORG-1154). See
 * `migrateBlockIntro.ts` for what is rewritten.
 *
 * Usage, from the cms directory:
 *   pnpm exec tsx scripts/migrate-block-intro.ts --dry-run
 *   pnpm exec tsx scripts/migrate-block-intro.ts
 *   pnpm exec tsx scripts/migrate-block-intro.ts --fold
 * then `node scripts/format-mdx.mjs --write` from the repo root.
 *
 * Without --fold, fake intros are only listed. With it, the clean ones are
 * folded into their block; the rest stay listed for an editor.
 */

import fs from 'fs'
import path from 'path'
import { migrateBlockIntro } from './migrateBlockIntro'

const DRY_RUN = process.argv.includes('--dry-run')
const FOLD = process.argv.includes('--fold')

const REPO_ROOT = path.resolve(__dirname, '../..')
const CONTENT_ROOT = path.join(REPO_ROOT, 'src/content')

/** Starlight docs and UI strings hold no Strapi blocks. */
const SKIPPED_COLLECTIONS = new Set(['docs', 'i18n'])

function listMdxFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => path.join(dir, file))
}

function contentFiles(): string[] {
  return fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !SKIPPED_COLLECTIONS.has(entry.name))
    .flatMap((entry) => listMdxFiles(path.join(CONTENT_ROOT, entry.name)))
}

function main(): void {
  let changed = 0
  let folded = 0
  let failed = 0
  for (const file of contentFiles()) {
    const relative = path.relative(REPO_ROOT, file)
    const raw = fs.readFileSync(file, 'utf-8')
    const result = migrateBlockIntro(raw, { fold: FOLD })
    if (result instanceof Error) {
      failed++
      console.error(`❌ ${relative}: ${result.message}`)
      continue
    }
    for (const report of result.folded) {
      console.log(`🧩 ${relative}:${report.line} folded into ${report.block}`)
    }
    for (const report of result.skipped) {
      console.log(
        `⚠️  ${relative}:${report.line} fake intro before ${report.block} left alone: ${report.reason}`
      )
    }
    folded += result.folded.length
    if (result.source === null) continue
    changed++
    console.log(`✏️  ${relative}`)
    if (!DRY_RUN) fs.writeFileSync(file, result.source, 'utf-8')
  }
  console.log(
    `\n${DRY_RUN ? 'Would change' : 'Changed'} ${changed} MDX files (${folded} fake intros folded, ${failed} files failed to parse).`
  )
  if (failed > 0) process.exitCode = 1
}

main()
