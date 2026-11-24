import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SESSIONIZE_DIR = path.resolve(__dirname, 'data/sessionize')

/**
 * Summit talk and speaker text must reach the repo as plain text (INTORG-1402).
 * Astro escapes `{text}` once on render, so an apostrophe stored as `&#039;`
 * would ship as `&amp;#039;` and show the entity, as the Drupal summit pages
 * did. A hit here means the Sessionize response arrived HTML-escaped.
 * Decode it in `fetchAndSave` in `scripts/sync-sessionize.ts`, which writes
 * the response as it arrives, so the next `pnpm sync:sessionize` keeps the
 * plain text. Keep rendering the field with `{text}`.
 *
 * Only real references count. A semicolon is optional, because Astro still
 * escapes a bare `&#39` or `&amp` and the page shows the reference. A named
 * entity must not run on into a longer word, so `AT&T;` and `&amplitude`
 * stay plain text.
 */
const HTML_ENTITY =
  /&(?:#(?:x[\da-f]+|\d+)|(?:amp|lt|gt|quot|apos|nbsp)(?![a-z\d]));?/i

function collectStrings(value: unknown, at: string): [string, string][] {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectStrings(item, `${at}[${index}]`)
    )
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      collectStrings(item, `${at}.${key}`)
    )
  }
  return []
}

function findHtmlEntities(file: string): string[] {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'))
  return collectStrings(data, path.basename(file))
    .filter(([, text]) => HTML_ENTITY.test(text))
    .map(([at, text]) => `${at}: ${text.match(HTML_ENTITY)?.[0]}`)
}

const sessionizeFiles = readdirSync(SESSIONIZE_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => path.join(SESSIONIZE_DIR, file))

describe('Sessionize data HTML entities', () => {
  it('recognizes numeric, hex and named entities, with or without a semicolon', () => {
    expect(HTML_ENTITY.test('India&#039;s')).toBe(true)
    expect(HTML_ENTITY.test('India&#39s')).toBe(true)
    expect(HTML_ENTITY.test('India&#x27;s')).toBe(true)
    expect(HTML_ENTITY.test('India&#x27s')).toBe(true)
    expect(HTML_ENTITY.test('Q&amp;A')).toBe(true)
    expect(HTML_ENTITY.test('Q&amp A')).toBe(true)
    expect(HTML_ENTITY.test('&lt;tag&gt;')).toBe(true)
    expect(HTML_ENTITY.test('&quot;hi&quot;')).toBe(true)
    expect(HTML_ENTITY.test('it&apos;s')).toBe(true)
    expect(HTML_ENTITY.test('a&nbsp;b')).toBe(true)
    expect(HTML_ENTITY.test("India's")).toBe(false)
    expect(HTML_ENTITY.test('R & D, Q&A')).toBe(false)
    expect(HTML_ENTITY.test('AT&T; later at')).toBe(false)
    expect(HTML_ENTITY.test('&amplitude')).toBe(false)
  })

  it('reports where each entity sits in nested data', () => {
    expect(
      collectStrings({ sessions: [{ description: 'a' }] }, 'talks.json')
    ).toEqual([['talks.json.sessions[0].description', 'a']])
  })

  it('finds the Sessionize files', () => {
    expect(sessionizeFiles.length).toBeGreaterThan(0)
  })

  it.each(sessionizeFiles.map((file) => [path.basename(file), file]))(
    '%s stores plain text, not HTML entities',
    (_name, file) => {
      expect(findHtmlEntities(file)).toEqual([])
    }
  )
})
