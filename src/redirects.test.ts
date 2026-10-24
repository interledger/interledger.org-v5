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

// Netlify serves every page at /path/, so a slashless page destination costs
// a second 301 hop. Files and external URLs are not pages, so they keep their
// form.
describe('hand-written redirect destinations', () => {
  const readRepoFile = (file: string) =>
    readFileSync(path.resolve(__dirname, '..', file), 'utf8')
  const isPageDestination = (to: string) =>
    to.startsWith('/') && !isFilePath(to)
  // A page ends in a slash, except after `:splat`: it already holds the
  // request's trailing slash (`/all/x/2/` gives `2/`), so `:splat/` would
  // redirect to `…/2//`.
  const hasPageEnding = (to: string) =>
    to.endsWith(':splat') || (to.endsWith('/') && !to.endsWith(':splat/'))
  const isMisSlashed = (to: string) =>
    isPageDestination(to) && !hasPageEnding(to)

  it.each<[string, boolean]>([
    ['/grant/tag/:tag/', false],
    ['/grant/tag/:tag', true],
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
