import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  REDIRECT_CATEGORIES,
  normalizeRedirectInput,
  normalizeRedirectSource,
  redirectConfigToEntries,
  redirectDeleteError,
  redirectTargetPath,
  serializeRedirectConfig,
  validateRedirectInput,
  validateRedirectLinks,
  type RedirectEntry,
  type RedirectFinder
} from './redirects'
import pathCases from './redirectPathCases.json'

function fieldErrors(err: unknown): { path: string[]; message: string }[] {
  const details = (err as { details?: { errors?: unknown[] } }).details
  return (details?.errors ?? []) as { path: string[]; message: string }[]
}

function erroredFields(err: unknown): string[] {
  return fieldErrors(err).map((e) => e.path.join('.'))
}

describe('normalizeRedirectSource', () => {
  it.each([
    ['/about/', '/about'],
    ['  /about  ', '/about'],
    ['/about///', '/about'],
    ['/', '/'],
    ['', '']
  ])('%j → %j', (input, expected) => {
    expect(normalizeRedirectSource(input)).toBe(expected)
  })
})

describe('normalizeRedirectInput', () => {
  it('canonicalizes the source and trims the destination', () => {
    const data: Record<string, unknown> = {
      source: ' /old/ ',
      destination: ' /new/ '
    }
    normalizeRedirectInput(data)
    expect(data).toEqual({ source: '/old', destination: '/new/' })
  })

  it('leaves absent and non-string fields alone', () => {
    const data: Record<string, unknown> = { category: 'hackathon' }
    normalizeRedirectInput(data)
    expect(data).toEqual({ category: 'hackathon' })
  })
})

describe('validateRedirectInput', () => {
  const create = { isCreate: true }
  const update = { isCreate: false }

  it('accepts a literal path to a path', () => {
    expect(
      validateRedirectInput({ source: '/old', destination: '/new' }, create)
    ).toBeUndefined()
  })

  it.each(['https://example.org/docs', 'HTTPS://Example.org/docs'])(
    'accepts an absolute https destination (%s)',
    (destination) => {
      expect(
        validateRedirectInput({ source: '/docs', destination }, create)
      ).toBeUndefined()
    }
  )

  it('accepts & in a source, as the legacy blog tag URLs use', () => {
    expect(
      validateRedirectInput(
        { source: '/blog/tag/community-&-events', destination: '/blog' },
        create
      )
    ).toBeUndefined()
  })

  it('reports both fields when both are missing on create', () => {
    expect(erroredFields(validateRedirectInput({}, create))).toEqual([
      'source',
      'destination'
    ])
  })

  it.each([
    ['a relative path', 'old-page'],
    ['a full URL', 'https://interledger.org/old'],
    ['a double slash', '/es/summit//hackathons'],
    ['a Netlify param', '/summit/:year/talk'],
    ['a splat', '/news/*'],
    ['an Astro dynamic segment', '/blog/[slug]'],
    ['a query string', '/old?x=1'],
    ['a fragment', '/old#top'],
    ['a space', '/old page'],
    ['only whitespace', '   ']
  ])('rejects a source with %s', (_label, source) => {
    expect(
      erroredFields(
        validateRedirectInput({ source, destination: '/new' }, create)
      )
    ).toEqual(['source'])
  })

  it.each([
    ['a relative path', 'new-page'],
    ['a protocol-relative URL', '//evil.example/x'],
    ['a mailto link', 'mailto:hi@example.org'],
    ['an insecure http URL', 'http://example.org/docs'],
    ['an uppercase insecure HTTP URL', 'HTTP://example.org/docs'],
    ['an https URL with no host', 'https:///docs'],
    ['a bare https scheme', 'https://'],
    ['an empty string', '']
  ])('rejects a destination with %s', (_label, destination) => {
    expect(
      erroredFields(
        validateRedirectInput({ source: '/old', destination }, create)
      )
    ).toEqual(['destination'])
  })

  it('rejects a self-redirect, ignoring a trailing slash', () => {
    expect(
      erroredFields(
        validateRedirectInput(
          { source: '/same/', destination: '/same/' },
          create
        )
      )
    ).toEqual(['destination'])
  })

  it('skips fields an update does not touch', () => {
    expect(validateRedirectInput({ note: 'why' }, update)).toBeUndefined()
  })

  it('still checks a field an update does touch', () => {
    expect(
      erroredFields(validateRedirectInput({ source: '/a/:b' }, update))
    ).toEqual(['source'])
  })
})

describe('serializeRedirectConfig', () => {
  it('writes every category, even with no redirects', () => {
    const config = serializeRedirectConfig([])
    expect(Object.keys(config)).toEqual([...REDIRECT_CATEGORIES])
    expect(Object.values(config).every((rules) => rules.length === 0)).toBe(
      true
    )
  })

  it('groups by category and sorts each by source in code-point order', () => {
    const entries: RedirectEntry[] = [
      { source: '/b', destination: '/x', category: 'site_pages' },
      { source: '/B', destination: '/x', category: 'site_pages' },
      { source: '/a', destination: '/x', category: 'site_pages' },
      {
        source: '/hackathons',
        destination: '/hackathon',
        category: 'hackathon'
      }
    ]
    const config = serializeRedirectConfig(entries)
    expect(config.site_pages.map((rule) => rule.source)).toEqual([
      '/B',
      '/a',
      '/b'
    ])
    expect(config.hackathon).toHaveLength(1)
  })

  it('maps the redirect type to a status, defaulting to permanent', () => {
    const config = serializeRedirectConfig([
      { source: '/a', destination: '/x', category: 'site_pages' },
      {
        source: '/b',
        destination: '/y',
        category: 'site_pages',
        redirectType: 'temporary'
      }
    ])
    expect(config.site_pages.map((rule) => rule.status)).toEqual([301, 302])
  })

  it('marks only disabled redirects, treating a null enabled as on', () => {
    const config = serializeRedirectConfig([
      { source: '/a', destination: '/x', category: 'summit', enabled: false },
      { source: '/b', destination: '/y', category: 'summit', enabled: true },
      { source: '/c', destination: '/z', category: 'summit', enabled: null }
    ])
    expect(config.summit).toEqual([
      { source: '/a', destination: '/x', status: 301, enabled: false },
      { source: '/b', destination: '/y', status: 301 },
      { source: '/c', destination: '/z', status: 301 }
    ])
  })

  it('keeps a note and drops a blank one', () => {
    const config = serializeRedirectConfig([
      { source: '/a', destination: '/x', category: 'summit', note: ' why ' },
      { source: '/b', destination: '/y', category: 'summit', note: '  ' },
      { source: '/c', destination: '/z', category: 'summit', note: null }
    ])
    expect(config.summit).toEqual([
      { source: '/a', destination: '/x', status: 301, note: 'why' },
      { source: '/b', destination: '/y', status: 301 },
      { source: '/c', destination: '/z', status: 301 }
    ])
  })

  it('skips an entry with an unknown category rather than inventing one', () => {
    const config = serializeRedirectConfig([
      {
        source: '/a',
        destination: '/x',
        category: 'retired' as RedirectEntry['category']
      }
    ])
    expect(Object.values(config).flat()).toEqual([])
    expect(config).not.toHaveProperty('retired')
  })
})

interface Row {
  documentId: string
  source: string
  destination: string
  enabled?: boolean | null
}

/** An in-memory stand-in for the document service's filter subset we use. */
function fakeFinder(rows: Row[]): RedirectFinder {
  return {
    findOne: async ({ documentId }) =>
      rows.find((row) => row.documentId === documentId) ?? null,
    findMany: async ({ filters }) => {
      const { source, destination } = filters as {
        source?: string
        destination?: { $in?: string[]; $startsWith?: string }
      }
      return rows.filter(
        (row) =>
          (source === undefined || row.source === source) &&
          (destination?.$in === undefined ||
            destination.$in.includes(row.destination)) &&
          (destination?.$startsWith === undefined ||
            row.destination.startsWith(destination.$startsWith))
      )
    }
  }
}

describe('validateRedirectLinks', () => {
  const rows: Row[] = [
    { documentId: 'a', source: '/old', destination: '/new' },
    { documentId: 'b', source: '/legacy', destination: '/tech/overview/' }
  ]
  const documents = fakeFinder(rows)

  it('accepts a redirect that touches no other', async () => {
    await expect(
      validateRedirectLinks({
        documents,
        data: { source: '/fresh', destination: '/somewhere' }
      })
    ).resolves.toBeUndefined()
  })

  it('rejects a destination that is another redirect’s source', async () => {
    const err = await validateRedirectLinks({
      documents,
      data: { source: '/older', destination: '/old/' }
    })
    expect(erroredFields(err)).toEqual(['destination'])
    expect(fieldErrors(err)[0]!.message).toContain('/new')
  })

  it('rejects a source another redirect already points at', async () => {
    const err = await validateRedirectLinks({
      documents,
      data: { source: '/tech/overview', destination: '/tech' }
    })
    expect(erroredFields(err)).toEqual(['source'])
    expect(fieldErrors(err)[0]!.message).toContain('/legacy')
  })

  it('does not treat an entry as chaining onto itself', async () => {
    await expect(
      validateRedirectLinks({
        documents,
        documentId: 'a',
        data: { destination: '/newer' }
      })
    ).resolves.toBeUndefined()
  })

  it('reads the stored source on a destination-only update', async () => {
    const err = await validateRedirectLinks({
      documents,
      documentId: 'a',
      data: { destination: '/old/' }
    })
    expect(erroredFields(err)).toEqual(['destination'])
    expect(fieldErrors(err)[0]!.message).toContain('same as the old one')
  })

  it('leaves a missing half to the field validator', async () => {
    await expect(
      validateRedirectLinks({ documents, data: { source: '/only' } })
    ).resolves.toBeUndefined()
  })
})

describe('redirectConfigToEntries', () => {
  it('flattens the grouped JSON and maps status to a redirect type', () => {
    expect(
      redirectConfigToEntries({
        hackathon: [
          { source: '/a', destination: '/b', status: 302, note: 'why' }
        ]
      })
    ).toEqual([
      {
        source: '/a',
        destination: '/b',
        category: 'hackathon',
        redirectType: 'temporary',
        enabled: true,
        note: 'why'
      }
    ])
  })

  it('carries a disabled rule through and back unchanged', () => {
    const config = {
      hackathon: [
        {
          source: '/a',
          destination: '/b',
          status: 301 as const,
          enabled: false as const
        }
      ]
    }
    const entries = redirectConfigToEntries(config) as RedirectEntry[]
    expect(entries[0]!.enabled).toBe(false)
    expect(serializeRedirectConfig(entries).hackathon).toEqual(config.hackathon)
  })

  it('returns an error naming the source for an unsupported status', () => {
    const result = redirectConfigToEntries({
      site_pages: [{ source: '/a', destination: '/b', status: 307 as 301 }]
    })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('/a')
  })

  // The seed script loads this file into Strapi and the lifecycle writes it
  // back out. If the round trip is not byte-identical, an editor's first save
  // rewrites the whole file instead of changing one line.
  it('round-trips the committed redirects.json byte for byte', () => {
    const file = path.resolve(__dirname, '../../../src/config/redirects.json')
    const committed = fs.readFileSync(file, 'utf-8')
    const entries = redirectConfigToEntries(JSON.parse(committed))
    expect(entries).not.toBeInstanceOf(Error)
    const rewritten =
      JSON.stringify(
        serializeRedirectConfig(entries as RedirectEntry[]),
        null,
        2
      ) + '\n'
    expect(rewritten).toBe(committed)
  })

  it('passes every committed redirect through the input validator', () => {
    const file = path.resolve(__dirname, '../../../src/config/redirects.json')
    const entries = redirectConfigToEntries(
      JSON.parse(fs.readFileSync(file, 'utf-8'))
    ) as RedirectEntry[]
    const rejected = entries.filter((entry) =>
      validateRedirectInput(
        { source: entry.source, destination: entry.destination },
        { isCreate: true }
      )
    )
    expect(rejected.map((entry) => entry.source)).toEqual([])
  })
})

describe('validateRedirectLinks with disabled redirects', () => {
  const rows: Row[] = [
    { documentId: 'a', source: '/old', destination: '/new' },
    {
      documentId: 'c',
      source: '/retired',
      destination: '/archive',
      enabled: false
    },
    { documentId: 'd', source: '/parked', destination: '/old', enabled: false }
  ]
  const documents = fakeFinder(rows)

  it('ignores a disabled redirect on the far side of a chain', async () => {
    await expect(
      validateRedirectLinks({
        documents,
        data: { source: '/older', destination: '/retired' }
      })
    ).resolves.toBeUndefined()
  })

  it('ignores a disabled redirect pointing at this source', async () => {
    await expect(
      validateRedirectLinks({
        documents,
        documentId: 'a',
        data: { destination: '/newer' }
      })
    ).resolves.toBeUndefined()
  })

  it('skips the chain check when the write disables the redirect', async () => {
    await expect(
      validateRedirectLinks({
        documents,
        data: { source: '/older', destination: '/old', enabled: false }
      })
    ).resolves.toBeUndefined()
  })

  it('checks for chains again when a redirect is switched back on', async () => {
    const err = await validateRedirectLinks({
      documents,
      documentId: 'd',
      data: { enabled: true }
    })
    expect(erroredFields(err)).toEqual(['destination'])
  })

  it('still rejects a self-redirect while disabled', async () => {
    const err = await validateRedirectLinks({
      documents,
      data: { source: '/x', destination: '/x/', enabled: false }
    })
    expect(erroredFields(err)).toEqual(['destination'])
  })
})

describe('redirectDeleteError', () => {
  it('tells the editor to switch the redirect off instead', () => {
    expect(redirectDeleteError().message).toContain('Enabled')
  })
})

// The same cases drive the Astro loader's copy of these rules
// (src/utils/shared/redirects.test.ts), so the two can't drift apart.
describe('validateRedirectInput path cases shared with the loader', () => {
  const create = { isCreate: true }

  it.each(pathCases.sources.valid)('accepts source %s', (source) => {
    expect(
      validateRedirectInput({ source, destination: '/elsewhere' }, create)
    ).toBeUndefined()
  })

  it.each(pathCases.sources.invalid)('rejects source %s', (source) => {
    expect(
      erroredFields(
        validateRedirectInput({ source, destination: '/elsewhere' }, create)
      )
    ).toEqual(['source'])
  })

  it.each(pathCases.destinations.valid)(
    'accepts destination %s',
    (destination) => {
      expect(
        validateRedirectInput({ source: '/old', destination }, create)
      ).toBeUndefined()
    }
  )

  it.each(pathCases.destinations.invalid)(
    'rejects destination %s',
    (destination) => {
      expect(
        erroredFields(
          validateRedirectInput({ source: '/old', destination }, create)
        )
      ).toEqual(['destination'])
    }
  )
})

describe('redirectTargetPath', () => {
  it.each([
    ['/second', '/second'],
    ['/second/', '/second'],
    ['/second?x=1', '/second'],
    ['/second#top', '/second'],
    ['/second/?x=1#top', '/second'],
    ['/', '/'],
    ['/?x=1', '/']
  ])('%s → %s', (destination, expected) => {
    expect(redirectTargetPath(destination)).toBe(expected)
  })

  it.each(['https://example.org/second', '//example.org/second'])(
    'has no on-site path for %s',
    (destination) => {
      expect(redirectTargetPath(destination)).toBeUndefined()
    }
  )
})

// Netlify matches a source by path alone, so a query or fragment on a
// destination doesn't stop it hitting another redirect.
describe('validateRedirectLinks with a query or fragment destination', () => {
  const rows: Row[] = [
    { documentId: 'a', source: '/second', destination: '/third' },
    { documentId: 'b', source: '/campaign', destination: '/landing?utm=1' }
  ]
  const documents = fakeFinder(rows)

  it.each(['/second?x=1', '/second#top', '/second/?x=1'])(
    'rejects a destination whose path is another source (%s)',
    async (destination) => {
      const err = await validateRedirectLinks({
        documents,
        data: { source: '/first', destination }
      })
      expect(erroredFields(err)).toEqual(['destination'])
      expect(fieldErrors(err)[0]!.message).toContain('/third')
    }
  )

  it('rejects a source another redirect reaches with a query', async () => {
    const err = await validateRedirectLinks({
      documents,
      data: { source: '/landing', destination: '/home' }
    })
    expect(erroredFields(err)).toEqual(['source'])
    expect(fieldErrors(err)[0]!.message).toContain('/campaign')
  })

  it('ignores a destination that only shares a prefix', async () => {
    // /landingzone starts with "/landing", so the query returns it, but it is
    // a different path and doesn't chain with a /landing redirect.
    await expect(
      validateRedirectLinks({
        documents: fakeFinder([
          { documentId: 'c', source: '/near', destination: '/landingzone' }
        ]),
        data: { source: '/landing', destination: '/home' }
      })
    ).resolves.toBeUndefined()
  })

  it.each(['/about#team', '/about/?x=1'])(
    'treats %s from /about as a self-redirect',
    async (destination) => {
      const err = await validateRedirectLinks({
        documents,
        data: { source: '/about', destination }
      })
      expect(erroredFields(err)).toEqual(['destination'])
      expect(fieldErrors(err)[0]!.message).toContain('same as the old one')
    }
  )

  it('leaves an external destination out of the chain check', async () => {
    await expect(
      validateRedirectLinks({
        documents,
        data: { source: '/docs', destination: 'https://example.org/second' }
      })
    ).resolves.toBeUndefined()
  })
})
