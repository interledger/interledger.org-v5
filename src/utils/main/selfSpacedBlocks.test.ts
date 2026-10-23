import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OWNS_ITS_SPACING, SELF_SPACED_BLOCKS } from './dynamicZoneSpacing'

const BLOCKS_DIR = path.resolve(import.meta.dirname, '../../components/blocks')
const DYNAMIC_ZONE = path.join(BLOCKS_DIR, 'DynamicZone.astro')

/**
 * The Strapi uid → component file map that DynamicZone.astro renders the
 * preview with, read from its imports and its `componentMap`.
 */
function previewComponentFiles(): Map<string, string> {
  const source = readFileSync(DYNAMIC_ZONE, 'utf8')
  const importPaths = new Map(
    [...source.matchAll(/^import (\w+) from '(.+\.astro)'$/gm)].map(
      ([, name, from]) => [name, from]
    )
  )
  const files = new Map<string, string>()
  for (const [, uid, name] of source.matchAll(/'([\w.-]+)': (\w+)/g)) {
    const from = importPaths.get(name)
    if (!from) continue
    files.set(
      uid,
      from.startsWith('@/')
        ? path.resolve(BLOCKS_DIR, '../..', from.slice(2))
        : path.resolve(BLOCKS_DIR, from)
    )
  }
  return files
}

/**
 * Preview components that hand their whole render to another component,
 * which sets the root. Listed by hand: following every import would also
 * count a component that only renders an intro block as one of its children.
 */
const RENDERED_BY: Readonly<Record<string, string>> = {
  'ProfileGridBlock.astro': '../shared/ProfileGrid.astro'
}

function rendersIntroRoot(file: string): boolean {
  const source = readFileSync(file, 'utf8')
  return (
    source.includes('data-intro-variant=') ||
    source.includes('<IntroBlockFrame')
  )
}

/** Sets the attribute itself, through IntroBlockFrame, or via RENDERED_BY. */
function setsIntroVariant(file: string): boolean {
  const delegate = RENDERED_BY[path.basename(file)]
  return rendersIntroRoot(
    delegate ? path.resolve(path.dirname(file), delegate) : file
  )
}

describe('SELF_SPACED_BLOCKS', () => {
  const files = previewComponentFiles()

  it('reads the preview component map', () => {
    expect(files.get('blocks.paragraph')).toBe(
      path.join(BLOCKS_DIR, 'Paragraph.astro')
    )
  })

  it('lists exactly the preview blocks whose root sets data-intro-variant', () => {
    // The preview gives a self-spaced block no section gap. A block missing
    // here would sit an extra --space-section lower in the preview; one
    // listed without the attribute would lose its gap there.
    const selfSpaced = [...files]
      .filter(([uid]) => !OWNS_ITS_SPACING.has(uid))
      .filter(([, file]) => setsIntroVariant(file))
      .map(([uid]) => uid)
      .sort()
    expect(selfSpaced).toEqual([...SELF_SPACED_BLOCKS].sort())
  })
})
