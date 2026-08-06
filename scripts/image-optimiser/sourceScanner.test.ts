import { describe, expect, it } from 'vitest'
import { RASTER_EXTENSIONS } from './config'
import { SourceScanner } from './sourceScanner'
import { InMemoryFileSystem } from './testDoubles'

const SOURCE_DIR = '/project/public/img'
const OUTPUT_DIR = '/project/public/img/optimized'

function createScanner(fileSystem: InMemoryFileSystem): SourceScanner {
  return new SourceScanner(
    { fileSystem },
    { rasterExtensions: RASTER_EXTENSIONS }
  )
}

describe('SourceScanner', () => {
  it('finds raster images recursively', () => {
    const fileSystem = new InMemoryFileSystem()
      .addFile(`${SOURCE_DIR}/hero.png`, 'x')
      .addFile(`${SOURCE_DIR}/blog/2026-01/cover.jpg`, 'x')
      .addFile(`${SOURCE_DIR}/blog/2026-01/inline.avif`, 'x')

    expect(createScanner(fileSystem).collect(SOURCE_DIR, [])).toEqual([
      `${SOURCE_DIR}/blog/2026-01/cover.jpg`,
      `${SOURCE_DIR}/blog/2026-01/inline.avif`,
      `${SOURCE_DIR}/hero.png`
    ])
  })

  it('skips non-raster files, including animated GIFs', () => {
    const fileSystem = new InMemoryFileSystem()
      .addFile(`${SOURCE_DIR}/hero.png`, 'x')
      .addFile(`${SOURCE_DIR}/diagram.svg`, 'x')
      .addFile(`${SOURCE_DIR}/spinner.gif`, 'x')
      .addFile(`${SOURCE_DIR}/notes.md`, 'x')
      .addFile(`${SOURCE_DIR}/no-extension`, 'x')

    expect(createScanner(fileSystem).collect(SOURCE_DIR, [])).toEqual([
      `${SOURCE_DIR}/hero.png`
    ])
  })

  it('matches extensions case-insensitively', () => {
    const fileSystem = new InMemoryFileSystem()
      .addFile(`${SOURCE_DIR}/SHOUTING.JPG`, 'x')
      .addFile(`${SOURCE_DIR}/mixed.PnG`, 'x')

    expect(createScanner(fileSystem).collect(SOURCE_DIR, [])).toEqual([
      `${SOURCE_DIR}/SHOUTING.JPG`,
      `${SOURCE_DIR}/mixed.PnG`
    ])
  })

  it('excludes the generated output tree nested inside a source directory', () => {
    const fileSystem = new InMemoryFileSystem()
      .addFile(`${SOURCE_DIR}/hero.png`, 'x')
      .addFile(`${OUTPUT_DIR}/hero-640.webp`, 'x')
      .addFile(`${OUTPUT_DIR}/uploads/logo-640.avif`, 'x')

    expect(createScanner(fileSystem).collect(SOURCE_DIR, [OUTPUT_DIR])).toEqual(
      [`${SOURCE_DIR}/hero.png`]
    )
  })

  it('returns nothing for a directory that does not exist', () => {
    expect(
      createScanner(new InMemoryFileSystem()).collect('/project/public/img', [])
    ).toEqual([])
  })

  it('returns files in a stable order regardless of directory listing order', () => {
    const names = ['zebra.png', 'apple.png', 'mango.png']
    const forward = new InMemoryFileSystem()
    const reversed = new InMemoryFileSystem()
    for (const name of names) forward.addFile(`${SOURCE_DIR}/${name}`, 'x')
    for (const name of [...names].reverse()) {
      reversed.addFile(`${SOURCE_DIR}/${name}`, 'x')
    }

    const expected = [
      `${SOURCE_DIR}/apple.png`,
      `${SOURCE_DIR}/mango.png`,
      `${SOURCE_DIR}/zebra.png`
    ]
    expect(createScanner(forward).collect(SOURCE_DIR, [])).toEqual(expected)
    expect(createScanner(reversed).collect(SOURCE_DIR, [])).toEqual(expected)
  })
})
