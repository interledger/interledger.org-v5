import { describe, expect, it } from 'vitest'
import { CACHE_MANIFEST_FILE_NAME } from './config'
import { RuntimeManifestWriter } from './runtimeManifest'
import { InMemoryFileSystem } from './testDoubles'

const PUBLIC_DIR = '/project/public'
const OUTPUT_DIR = `${PUBLIC_DIR}/img/optimized`
const MANIFEST_PATH = '/project/src/generated/optimized-image-manifest.json'

function createWriter(fileSystem: InMemoryFileSystem): RuntimeManifestWriter {
  return new RuntimeManifestWriter(
    { fileSystem },
    {
      publicDir: PUBLIC_DIR,
      outputBaseDir: OUTPUT_DIR,
      manifestPath: MANIFEST_PATH,
      cacheManifestFileName: CACHE_MANIFEST_FILE_NAME
    }
  )
}

describe('RuntimeManifestWriter', () => {
  it('catalogs every variant in the output tree as a public URL', () => {
    const fileSystem = new InMemoryFileSystem()
      .addFile(`${OUTPUT_DIR}/hero-640.webp`, 'x')
      .addFile(`${OUTPUT_DIR}/hero-640.avif`, 'x')
      .addFile(`${OUTPUT_DIR}/blog/cover-1280.webp`, 'x')
      .addFile(`${OUTPUT_DIR}/uploads/logo-full.avif`, 'x')

    expect(createWriter(fileSystem).write()).toEqual({
      version: 1,
      variants: [
        '/img/optimized/blog/cover-1280.webp',
        '/img/optimized/hero-640.avif',
        '/img/optimized/hero-640.webp',
        '/img/optimized/uploads/logo-full.avif'
      ]
    })
  })

  it('includes variants cached from earlier runs, not just this run’s output', () => {
    // The walk is over the output tree precisely so skipped sources stay listed.
    const fileSystem = new InMemoryFileSystem().addFile(
      `${OUTPUT_DIR}/cached-from-last-build-640.webp`,
      'x'
    )

    expect(createWriter(fileSystem).write().variants).toEqual([
      '/img/optimized/cached-from-last-build-640.webp'
    ])
  })

  it('leaves out the cache manifest and anything that is not a variant', () => {
    const fileSystem = new InMemoryFileSystem()
      .addFile(`${OUTPUT_DIR}/${CACHE_MANIFEST_FILE_NAME}`, '{}')
      .addFile(`${OUTPUT_DIR}/nested/${CACHE_MANIFEST_FILE_NAME}`, '{}')
      .addFile(`${OUTPUT_DIR}/stray.png`, 'x')
      .addFile(`${OUTPUT_DIR}/README.md`, 'x')
      .addFile(`${OUTPUT_DIR}/hero-640.webp`, 'x')

    expect(createWriter(fileSystem).write().variants).toEqual([
      '/img/optimized/hero-640.webp'
    ])
  })

  it('writes an empty catalog when nothing has been generated yet', () => {
    const fileSystem = new InMemoryFileSystem()

    expect(createWriter(fileSystem).write()).toEqual({
      version: 1,
      variants: []
    })
    expect(fileSystem.readTextFile(MANIFEST_PATH)).toBe(
      '{\n  "version": 1,\n  "variants": []\n}\n'
    )
  })

  it('writes pretty-printed JSON with a trailing newline', () => {
    const fileSystem = new InMemoryFileSystem().addFile(
      `${OUTPUT_DIR}/hero-640.webp`,
      'x'
    )

    const manifest = createWriter(fileSystem).write()

    expect(fileSystem.readTextFile(MANIFEST_PATH)).toBe(
      `${JSON.stringify(manifest, null, 2)}\n`
    )
  })
})
