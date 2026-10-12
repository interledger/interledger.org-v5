import { createRequire } from 'module'
import path from 'path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

const resolveFrom = (fromPackage: string, target: string): string => {
  const fromDir = path.dirname(require.resolve(`${fromPackage}/package.json`))
  return require.resolve(`${target}/package.json`, { paths: [fromDir] })
}

// app.tsx imports ckeditor5 directly for our editor plugins, and the Strapi
// CKEditor plugin imports its own. If they resolve to two copies, CKEditor
// throws `ckeditor-duplicated-modules` on load and the whole admin goes blank.
// Unit tests and `strapi build` both pass in that state. The plugin pins
// ckeditor5 with a tilde range, so a plugin patch release can cause it.
describe('ckeditor5 single copy', () => {
  it('resolves the same ckeditor5 for the admin and the CKEditor plugin', () => {
    expect(resolveFrom('@_sh/strapi-plugin-ckeditor', 'ckeditor5')).toBe(
      require.resolve('ckeditor5/package.json')
    )
  })
})
