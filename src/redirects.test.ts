import { readdirSync, readFileSync } from 'node:fs'
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

// An on-demand route that redirects to /404 answers 302, so the missing page
// never returns a 404 status. It rewrites to /preview/not-found instead, which
// renders the 404 page on demand with a 404 status. It can't rewrite to /404:
// Astro does not let an on-demand route rewrite to a prerendered one.
// Prerendered routes are not covered: there a redirect is a static page.
describe('on-demand routes', () => {
  const PAGES_DIR = 'src/pages'
  const isOnDemand = (source: string) =>
    /export\s+const\s+prerender\s*=\s*false\b/.test(source)
  const redirectsToNotFound = (source: string) =>
    /\.redirect\(\s*(['"`])\/404\/?\1/.test(source)

  const onDemandRoutes = readdirSync(path.resolve(__dirname, '..', PAGES_DIR), {
    recursive: true,
    encoding: 'utf8'
  })
    .filter((file) => /\.(astro|ts)$/.test(file) && !file.includes('.test.'))
    .map((file) => `${PAGES_DIR}/${file.replaceAll('\\', '/')}`)
    .filter((file) => isOnDemand(readRepoFile(file)))

  it.each<[string, boolean]>([
    ["return Astro.redirect('/404')", true],
    ['return Astro.redirect("/404/")', true],
    ['return Astro.redirect(`/404`, 302)', true],
    ["return Astro.rewrite('/preview/not-found')", false],
    ["return Astro.redirect('/404-guide/')", false]
  ])('flags %j as a redirect to /404: %j', (source, expected) => {
    expect(redirectsToNotFound(source)).toBe(expected)
  })

  it('finds the preview routes', () => {
    expect(onDemandRoutes).toEqual(
      expect.arrayContaining([
        'src/pages/page-preview.astro',
        'src/pages/profile-preview.astro',
        'src/pages/preview/page-preview.astro',
        'src/pages/preview/hackathon-preview.astro',
        'src/pages/preview/not-found.astro'
      ])
    )
  })

  it('never redirect to /404', () => {
    expect(
      onDemandRoutes.filter((file) => redirectsToNotFound(readRepoFile(file)))
    ).toEqual([])
  })

  it('render the preview 404 page with a 404 status', () => {
    expect(readRepoFile('src/pages/preview/not-found.astro')).toMatch(
      /Astro\.response\.status\s*=\s*404\b/
    )
  })
})
