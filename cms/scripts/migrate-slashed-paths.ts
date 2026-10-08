#!/usr/bin/env node

/**
 * One-time migration of stored slugs, internal links and redirects to
 * `/path/` (INTORG-1254). See `migrateSlashedPaths.ts` for what is rewritten.
 *
 * Usage, from the cms directory:
 *   pnpm exec tsx scripts/migrate-slashed-paths.ts --dry-run
 *   pnpm exec tsx scripts/migrate-slashed-paths.ts
 * then run `pnpm run format` from the repo root for the navigation JSON.
 */

import fs from 'fs'
import path from 'path'
import {
  migrateFrontmatterPaths,
  migrateNavigationHrefs,
  migrateRedirectConfig
} from './migrateSlashedPaths'

const DRY_RUN = process.argv.includes('--dry-run')

const REPO_ROOT = path.resolve(__dirname, '../..')
const CONTENT_ROOT = path.join(REPO_ROOT, 'src/content')
const CONFIG_ROOT = path.join(REPO_ROOT, 'src/config')

/** Starlight docs and UI strings carry no Strapi slugs. */
const SKIPPED_COLLECTIONS = new Set(['docs', 'i18n'])

const NAVIGATION_FILE = /-navigation(\.[a-z]{2})?\.json$/

function listMdxFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => path.join(dir, file))
}

function contentFiles(): string[] {
  return fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !SKIPPED_COLLECTIONS.has(entry.name))
    .flatMap((entry) => listMdxFiles(path.join(CONTENT_ROOT, entry.name)))
}

function migrateContent(): number {
  let changed = 0
  for (const file of contentFiles()) {
    const next = migrateFrontmatterPaths(fs.readFileSync(file, 'utf-8'))
    if (next === null) continue
    changed++
    console.log(`✏️  ${path.relative(REPO_ROOT, file)}`)
    if (!DRY_RUN) fs.writeFileSync(file, next, 'utf-8')
  }
  return changed
}

function migrateNavigation(): number {
  let changed = 0
  const files = fs
    .readdirSync(CONFIG_ROOT)
    .filter((file) => NAVIGATION_FILE.test(file))
  for (const name of files) {
    const file = path.join(CONFIG_ROOT, name)
    const raw = fs.readFileSync(file, 'utf-8')
    const tree = JSON.parse(raw)
    migrateNavigationHrefs(tree)
    const next = `${JSON.stringify(tree, null, 2)}\n`
    if (JSON.stringify(JSON.parse(raw)) === JSON.stringify(tree)) continue
    changed++
    console.log(`✏️  ${path.relative(REPO_ROOT, file)}`)
    if (!DRY_RUN) fs.writeFileSync(file, next, 'utf-8')
  }
  return changed
}

/** Returns 1 when the redirect file changed, 0 when it was already migrated. */
function migrateRedirects(): number {
  const file = path.join(CONFIG_ROOT, 'redirects.json')
  const raw = fs.readFileSync(file, 'utf-8')
  const config = migrateRedirectConfig(JSON.parse(raw))
  if (config instanceof Error) throw config
  const next = `${JSON.stringify(config, null, 2)}\n`
  if (next === raw) return 0
  console.log(`✏️  ${path.relative(REPO_ROOT, file)}`)
  if (!DRY_RUN) fs.writeFileSync(file, next, 'utf-8')
  return 1
}

function main(): void {
  const content = migrateContent()
  const navigation = migrateNavigation()
  const redirects = migrateRedirects()
  console.log(
    `\n${DRY_RUN ? 'Would change' : 'Changed'} ${content} MDX files, ${navigation} navigation files and ${redirects} redirect file.`
  )
}

main()
