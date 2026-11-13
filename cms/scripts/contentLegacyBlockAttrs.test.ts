import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findLegacyBlockAttrs } from './migrateBlockIntro'
import { RETIRED_HEADING_PROPS, SPLIT_LAYOUT } from './sync-mdx/retiredProps'

const CONTENT_DIR = path.resolve(__dirname, '../../src/content')

/** Starlight docs and UI strings hold no Strapi blocks. */
const SKIPPED_COLLECTIONS = new Set(['docs', 'i18n'])

/**
 * Only files that open one of these tags are worth parsing; most hold none,
 * and parsing every file outran vitest's 5s timeout on a CI runner.
 */
const RETIRED_PROP_BLOCK_TAG = new RegExp(
  `<(${[...Object.keys(RETIRED_HEADING_PROPS), SPLIT_LAYOUT].join('|')})\\b`
)

/**
 * The legacy block heading attributes (`title=`, `heading=`) and the Split
 * layout `cta*` attributes are gone from Strapi and the components
 * (INTORG-1154). The sync rejects a file that still carries one, but only
 * when it runs; this test catches it on the PR that adds it. Fix the clean
 * cases with `pnpm exec tsx scripts/migrate-block-intro.ts` from `cms/`, and
 * the rest by hand.
 */
function listMdxFiles(): string[] {
  return readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.mdx'))
    .filter((file) => !SKIPPED_COLLECTIONS.has(file.split(path.sep)[0]))
    .map((file) => path.join(CONTENT_DIR, file))
}

function describeLegacyBlockAttrs(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  if (!RETIRED_PROP_BLOCK_TAG.test(source)) return []

  const relative = path.relative(CONTENT_DIR, file)
  const found = findLegacyBlockAttrs(source)
  if (found instanceof Error) return [`${relative}: ${found.message}`]
  return found.map(
    ({ line, block, attr }) => `${relative}:${line} <${block} ${attr}=>`
  )
}

describe('content legacy block attributes', () => {
  it('finds MDX files to scan', () => {
    expect(listMdxFiles().length).toBeGreaterThan(0)
  })

  it('leaves no legacy heading or split layout cta attribute', () => {
    expect(listMdxFiles().flatMap(describeLegacyBlockAttrs)).toEqual([])
  })
})
