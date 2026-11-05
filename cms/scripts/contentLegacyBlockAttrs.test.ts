import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findLegacyBlockAttrs } from './migrateBlockIntro'

const CONTENT_DIR = path.resolve(__dirname, '../../src/content')

/**
 * Parsing every MDX file takes about 3s locally with coverage on and 11s on a
 * CI runner, past vitest's 5s default.
 */
const SCAN_TIMEOUT_MS = 60_000

/** Starlight docs and UI strings hold no Strapi blocks. */
const SKIPPED_COLLECTIONS = new Set(['docs', 'i18n'])

/**
 * The legacy block heading attributes (`title=`, `heading=`) and the Split
 * layout `cta*` attributes are gone from Strapi, the sync and the components
 * (INTORG-1154). A file that still carries one renders without that heading
 * or button, and the sync ignores it rather than failing, so this test is the
 * only place it shows up. Fix the clean cases with `pnpm exec tsx
 * scripts/migrate-block-intro.ts` from `cms/`, and the rest by hand.
 */
function listMdxFiles(): string[] {
  return readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.mdx'))
    .filter((file) => !SKIPPED_COLLECTIONS.has(file.split(path.sep)[0]))
    .map((file) => path.join(CONTENT_DIR, file))
}

function describeLegacyBlockAttrs(file: string): string[] {
  const relative = path.relative(CONTENT_DIR, file)
  const found = findLegacyBlockAttrs(readFileSync(file, 'utf8'))
  if (found instanceof Error) return [`${relative}: ${found.message}`]
  return found.map(
    ({ line, block, attr }) => `${relative}:${line} <${block} ${attr}=>`
  )
}

describe('content legacy block attributes', () => {
  it('finds MDX files to scan', () => {
    expect(listMdxFiles().length).toBeGreaterThan(0)
  })

  it(
    'leaves no legacy heading or split layout cta attribute',
    () => {
      expect(listMdxFiles().flatMap(describeLegacyBlockAttrs)).toEqual([])
    },
    SCAN_TIMEOUT_MS
  )
})
