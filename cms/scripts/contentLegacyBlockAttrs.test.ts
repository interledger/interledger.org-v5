import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrateBlockIntro } from './migrateBlockIntro'

const CONTENT_DIR = path.resolve(__dirname, '../../src/content')

/** Starlight docs and UI strings hold no Strapi blocks. */
const SKIPPED_COLLECTIONS = new Set(['docs', 'i18n'])

/**
 * The legacy block heading attributes (`title=`, `heading=`) and the Split
 * layout `cta*` attributes are gone from Strapi, the sync and the components
 * (INTORG-1154). A file that still carries one renders without that heading
 * or button, and the sync ignores it rather than failing, so this test is the
 * only place it shows up. The check is the migration itself: a file it would
 * rewrite is an offender. Fix one with `pnpm exec tsx
 * scripts/migrate-block-intro.ts` from `cms/`.
 */
function listMdxFiles(): string[] {
  return readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.mdx'))
    .filter((file) => !SKIPPED_COLLECTIONS.has(file.split(path.sep)[0]))
    .map((file) => path.join(CONTENT_DIR, file))
}

function findLegacyBlockAttrs(file: string): string[] {
  const result = migrateBlockIntro(readFileSync(file, 'utf8'))
  const relative = path.relative(CONTENT_DIR, file)
  if (result instanceof Error) return [`${relative}: ${result.message}`]
  return result.source === null ? [] : [relative]
}

describe('content legacy block attributes', () => {
  it('flags a block that still uses a legacy attribute', () => {
    const result = migrateBlockIntro('<Faq heading="About us" />\n')
    expect(result).not.toBeInstanceOf(Error)
    expect((result as { source: string | null }).source).not.toBeNull()
  })

  it('finds MDX files to scan', () => {
    expect(listMdxFiles().length).toBeGreaterThan(0)
  })

  it('uses only intro and buttons on migrated blocks', () => {
    expect(listMdxFiles().flatMap(findLegacyBlockAttrs)).toEqual([])
  })
})
