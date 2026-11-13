import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import config from '../astro.config.mjs'

// Both settings default to 'jsx' when they are not set.
const DEFAULT_MODE = 'jsx'

/** The prettier-plugin-astro mode that formats for an Astro compressHTML value. */
function prettierModeFor(compressHTML: boolean | 'jsx' | undefined): string {
  if (compressHTML === true) return 'html'
  if (compressHTML === false) return 'none'
  return compressHTML ?? DEFAULT_MODE
}

describe('Astro whitespace mode', () => {
  // The formatter moves whitespace by the rules of this mode. If the two
  // settings differ, formatting an .astro file can change the rendered page.
  it('matches between astro.config.mjs and .prettierrc', () => {
    const prettierrc = JSON.parse(
      readFileSync(path.join(import.meta.dirname, '../.prettierrc'), 'utf8')
    ) as { astroCompressHTML?: string }
    expect(prettierrc.astroCompressHTML ?? DEFAULT_MODE).toBe(
      prettierModeFor(config.compressHTML)
    )
  })
})
