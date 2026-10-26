import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { redirects } from '../redirects'
import redirectConfigJson from './config/redirects.json'
import redirectSchema from '../cms/src/api/redirect/content-types/redirect/schema.json'
import { parseRedirectConfig } from './utils/shared/redirects'
import { REDIRECT_CATEGORIES, type RedirectConfig } from './types/redirects'
import { isFilePath } from './utils/shared/url'
import {
  parseNetlifyRedirectRules,
  parseRedirectsFile
} from './integrations/validate-internal-links'

const config = parseRedirectConfig(redirectConfigJson) as RedirectConfig
const rules = REDIRECT_CATEGORIES.flatMap((category) => config[category])
const enabledRules = rules.filter((rule) => rule.enabled !== false)

describe('src/config/redirects.json', () => {
  // Parsing also enforces the rules Strapi applies on save (literal sources,
  // / or https:// destinations, unique sources, no self-redirects or chains),
  // and the build fails on any of them; see src/utils/shared/redirects.test.ts.
  it('parses', () => {
    expect(parseRedirectConfig(redirectConfigJson)).not.toBeInstanceOf(Error)
  })

  it('reaches Astro as one entry per enabled rule', () => {
    expect(Object.keys(redirects)).toHaveLength(enabledRules.length)
  })
})

describe('Strapi redirect schema', () => {
  it('offers exactly the categories the JSON is grouped by', () => {
    expect(redirectSchema.attributes.category.enum).toEqual([
      ...REDIRECT_CATEGORIES
    ])
  })
})

const readRepoFile = (file: string) =>
  readFileSync(path.resolve(__dirname, '..', file), 'utf8')

describe('public/_redirects', () => {
  // Netlify serves a file before any rule, so without "!" the 404 page answers
  // 200 at its own URL. Raw lines, because parseRedirectsFile drops the "!".
  it('forces a 404 status at /404 and /404.html', () => {
    const rules = readRepoFile('public/_redirects')
      .split('\n')
      .map((line) => line.trim().split(/\s+/))
    for (const notFoundPath of ['/404', '/404.html']) {
      expect(rules).toContainEqual([notFoundPath, '/404.html', '404!'])
    }
  })
})

// Netlify serves every page at /path/, so a slashless page destination costs
// a second 301 hop. Files and external URLs are not pages, so they keep their
// form.
describe('hand-written redirect destinations', () => {
  const isPageDestination = (to: string) =>
    to.startsWith('/') && !isFilePath(to)
  // A page ends in a slash, except after `:splat`: it already holds the
  // request's trailing slash (`/all/x/2/` gives `2/`), so `:splat/` would
  // redirect to `…/2//`.
  const hasPageEnding = (to: string) =>
    to.endsWith(':splat') || (to.endsWith('/') && !to.endsWith(':splat/'))
  // The query and fragment are cut first, as the build's slash guard does.
  const destinationPath = (to: string) => to.split(/[?#]/)[0]
  const isMisSlashed = (to: string) => {
    const pathname = destinationPath(to)
    return isPageDestination(pathname) && !hasPageEnding(pathname)
  }

  it.each<[string, boolean]>([
    ['/grant/tag/:tag/', false],
    ['/grant/tag/:tag', true],
    ['/grant/tag/:tag/?x=1', false],
    ['/grant/tag/:tag?x=1', true],
    ['/rss.xml?x=1', false],
    ['/grant/tag/:tag/:splat', false],
    ['/grant/tag/:tag/:splat/', true],
    ['/404.html', false],
    ['/rss.xml', false],
    ['https://github.com/interledger', false]
  ])('flags %j as mis-slashed: %j', (to, expected) => {
    expect(isMisSlashed(to)).toBe(expected)
  })

  it('slash every page destination in public/_redirects', () => {
    const destinations = parseRedirectsFile(
      readRepoFile('public/_redirects')
    ).map(({ to }) => to)
    expect(destinations.length).toBeGreaterThan(0)
    expect(destinations.filter(isMisSlashed)).toEqual([])
  })

  it('slash every page destination in netlify.toml', () => {
    const destinations = parseNetlifyRedirectRules(
      readRepoFile('netlify.toml')
    ).map(({ to }) => to)
    expect(destinations.length).toBeGreaterThan(0)
    expect(destinations.filter(isMisSlashed)).toEqual([])
  })
})
