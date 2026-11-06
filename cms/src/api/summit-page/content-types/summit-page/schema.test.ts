import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import schema from './schema.json'

const SUMMIT_PAGES_DIR = fileURLToPath(
  new URL('../../../../../../src/content/summit-pages', import.meta.url)
)

/** Summit MDX files, relative to the collection root. */
function summitMdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return summitMdxFiles(fullPath)
    if (!entry.name.endsWith('.mdx')) return []
    return [path.relative(SUMMIT_PAGES_DIR, fullPath)]
  })
}

describe('summit-page content zone', () => {
  it('allows CalloutText on every summit page that uses it', () => {
    // CalloutText imports as blocks.callout-text. A page that uses it cannot
    // sync while the dynamic zone omits that component.
    const usesCallout = summitMdxFiles(SUMMIT_PAGES_DIR).filter((file) =>
      readFileSync(path.join(SUMMIT_PAGES_DIR, file), 'utf8').includes(
        '<CalloutText'
      )
    )

    expect(usesCallout.sort()).toEqual(
      expect.arrayContaining([
        '2022.mdx',
        '2023.mdx',
        path.join('es', '2022.mdx'),
        path.join('es', '2023.mdx')
      ])
    )
    expect(schema.attributes.content.components).toContain(
      'blocks.callout-text'
    )
  })
})
