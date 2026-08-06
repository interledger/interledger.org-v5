import { describe, expect, it } from 'vitest'
import {
  CACHE_MANIFEST_VERSION,
  CacheManifest,
  CacheManifestStore
} from './cacheManifest'
import { InMemoryFileSystem, RecordingLogger } from './testDoubles'

const PIPELINE = 'webp90-avif85-exactWidth'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

function manifestJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: CACHE_MANIFEST_VERSION,
    pipelineId: PIPELINE,
    entries: { 'public/img/hero.png': { hash: HASH_A } },
    ...overrides
  })
}

function parseOrThrow(raw: string, pipelineId = PIPELINE): CacheManifest {
  const manifest = CacheManifest.parse(raw, pipelineId)
  if (manifest instanceof Error) throw manifest
  return manifest
}

describe('CacheManifest.parse', () => {
  it('reads a v2 manifest written by the same pipeline', () => {
    const manifest = parseOrThrow(manifestJson())

    expect(manifest.matches('public/img/hero.png', HASH_A)).toBe(true)
    expect(manifest.matches('public/img/hero.png', HASH_B)).toBe(false)
    expect(manifest.matches('public/img/missing.png', HASH_A)).toBe(false)
  })

  it('returns an Error for text that is not JSON', () => {
    const manifest = CacheManifest.parse('{ not json', PIPELINE)

    expect(manifest).toBeInstanceOf(Error)
    expect((manifest as Error).message).toMatch(/not valid JSON/)
  })

  it.each([
    ['an array', '[]'],
    ['a scalar', '"hello"']
  ])('returns an Error when the manifest is %s', (_label, raw) => {
    expect(CacheManifest.parse(raw, PIPELINE)).toBeInstanceOf(Error)
  })

  it('returns an Error for a version it does not understand', () => {
    const manifest = CacheManifest.parse(
      manifestJson({ version: 99 }),
      PIPELINE
    )

    expect(manifest).toBeInstanceOf(Error)
    expect((manifest as Error).message).toMatch(/version 99/)
  })

  it('returns an Error when entries are missing or the wrong shape', () => {
    expect(
      CacheManifest.parse(manifestJson({ entries: undefined }), PIPELINE)
    ).toBeInstanceOf(Error)
    expect(
      CacheManifest.parse(manifestJson({ entries: [] }), PIPELINE)
    ).toBeInstanceOf(Error)
  })

  it('treats a manifest from another pipeline as empty rather than corrupt', () => {
    const manifest = parseOrThrow(
      manifestJson({ pipelineId: 'webp80-avif80-oldNaming' })
    )

    expect(manifest.size).toBe(0)
    expect(manifest.pipelineId).toBe(PIPELINE)
  })

  it('drops individual malformed entries but keeps the rest', () => {
    const manifest = parseOrThrow(
      manifestJson({
        entries: {
          'public/img/good.png': { hash: HASH_A },
          'public/img/no-hash.png': {},
          'public/img/empty-hash.png': { hash: '' },
          'public/img/string-entry.png': HASH_B,
          'public/img/null-entry.png': null
        }
      })
    )

    expect(manifest.size).toBe(1)
    expect(manifest.matches('public/img/good.png', HASH_A)).toBe(true)
  })
})

describe('CacheManifest.parse — v1 migration', () => {
  it('carries v1 hashes forward so the cache survives the format change', () => {
    const manifest = parseOrThrow(
      JSON.stringify({
        'public/img/hero.png': `${PIPELINE}:${HASH_A}`,
        'public/uploads/img/original/logo.png': `${PIPELINE}:${HASH_B}`
      })
    )

    expect(manifest.size).toBe(2)
    expect(manifest.matches('public/img/hero.png', HASH_A)).toBe(true)
    expect(
      manifest.matches('public/uploads/img/original/logo.png', HASH_B)
    ).toBe(true)
  })

  it('drops v1 entries encoded by a different pipeline', () => {
    const manifest = parseOrThrow(
      JSON.stringify({
        'public/img/current.png': `${PIPELINE}:${HASH_A}`,
        'public/img/stale.png': `webp80-avif80-oldNaming:${HASH_B}`
      })
    )

    expect(manifest.size).toBe(1)
    expect(manifest.matches('public/img/current.png', HASH_A)).toBe(true)
  })

  it('ignores v1 values that are not "pipelineId:hash"', () => {
    const manifest = parseOrThrow(
      JSON.stringify({
        // A bare hash predates PIPELINE_ID, so the pipeline that wrote it is
        // unknown and its output cannot be trusted.
        'public/img/bare-hash.png': HASH_A,
        'public/img/no-hash.png': `${PIPELINE}:`,
        'public/img/not-a-string.png': 42
      })
    )

    expect(manifest.size).toBe(0)
  })

  it('re-serialises a migrated v1 manifest in the v2 shape', () => {
    const manifest = parseOrThrow(
      JSON.stringify({ 'public/img/hero.png': `${PIPELINE}:${HASH_A}` })
    )

    expect(manifest.toJSON()).toEqual({
      version: CACHE_MANIFEST_VERSION,
      pipelineId: PIPELINE,
      entries: { 'public/img/hero.png': { hash: HASH_A } }
    })
  })
})

describe('CacheManifest serialisation', () => {
  it('sorts keys so the file does not churn with encode order', () => {
    const manifest = CacheManifest.empty(PIPELINE)
    manifest.record('public/img/zebra.png', HASH_A)
    manifest.record('public/img/apple.png', HASH_B)

    expect(Object.keys(manifest.toJSON().entries)).toEqual([
      'public/img/apple.png',
      'public/img/zebra.png'
    ])
  })

  it('round-trips through parse', () => {
    const original = CacheManifest.empty(PIPELINE)
    original.record('public/img/hero.png', HASH_A)

    expect(parseOrThrow(original.serialise()).toJSON()).toEqual(
      original.toJSON()
    )
  })

  it('writes pretty-printed JSON with a trailing newline', () => {
    const manifest = CacheManifest.empty(PIPELINE)
    manifest.record('public/img/hero.png', HASH_A)

    expect(manifest.serialise()).toBe(
      `${JSON.stringify(manifest.toJSON(), null, 2)}\n`
    )
  })

  it('replaces the hash when a source is re-recorded', () => {
    const manifest = CacheManifest.empty(PIPELINE)
    manifest.record('public/img/hero.png', HASH_A)
    manifest.record('public/img/hero.png', HASH_B)

    expect(manifest.size).toBe(1)
    expect(manifest.matches('public/img/hero.png', HASH_B)).toBe(true)
  })
})

describe('CacheManifestStore', () => {
  const MANIFEST_PATH = '/project/public/img/optimized/.manifest.json'

  function createStore(fileSystem = new InMemoryFileSystem()) {
    const logger = new RecordingLogger()
    const store = new CacheManifestStore(
      { fileSystem, logger },
      { manifestPath: MANIFEST_PATH, pipelineId: PIPELINE }
    )
    return { store, fileSystem, logger }
  }

  it('starts empty when no manifest has been written yet', () => {
    const { store } = createStore()

    expect(store.load().size).toBe(0)
  })

  it('loads what it saved', () => {
    const { store, fileSystem } = createStore()
    const manifest = CacheManifest.empty(PIPELINE)
    manifest.record('public/img/hero.png', HASH_A)

    store.save(manifest)

    expect(fileSystem.readTextFile(MANIFEST_PATH)).toBe(manifest.serialise())
    expect(store.load().matches('public/img/hero.png', HASH_A)).toBe(true)
  })

  it('falls back to an empty manifest and says so when the file is corrupt', () => {
    const fileSystem = new InMemoryFileSystem().addFile(
      MANIFEST_PATH,
      'not json at all'
    )
    const { store, logger } = createStore(fileSystem)

    expect(store.load().size).toBe(0)
    expect(logger.messages.join('\n')).toMatch(/cache manifest ignored/)
  })
})
