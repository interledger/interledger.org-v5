import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  classifyHref,
  decodeHtmlEntities,
  distFileToTargets,
  extractAnchorIds,
  extractLinkTargets,
  formatFindings,
  netlifyRuleToMatcher,
  normalizeInternalPath,
  parseNetlifyRedirectRules,
  partitionRoutes,
  resolveTarget,
  validateInternalLinks,
  type Finding,
  type ResolvedRouteInput,
  type TargetIndex
} from './validate-internal-links'

const CTX = { fromPathname: '/blog/post', siteHost: 'interledger.org' }

describe('decodeHtmlEntities', () => {
  it('decodes the numeric ampersand that hides inside CDN URLs', () => {
    // The whole reason this function exists: `&#38;` contains a literal `#`.
    expect(decodeHtmlEntities('/a?url=x&#38;fm=avif&#38;w=640')).toBe(
      '/a?url=x&fm=avif&w=640'
    )
  })

  it('decodes named and hex entities', () => {
    expect(decodeHtmlEntities('a&amp;b')).toBe('a&b')
    expect(decodeHtmlEntities('a&#x26;b')).toBe('a&b')
    expect(decodeHtmlEntities('&quot;x&quot;')).toBe('"x"')
  })

  it('leaves unknown and out-of-range entities alone', () => {
    expect(decodeHtmlEntities('a&notreal;b')).toBe('a&notreal;b')
    expect(decodeHtmlEntities('a&#9999999999;b')).toBe('a&#9999999999;b')
  })
})

describe('classifyHref', () => {
  it('treats protocol-relative URLs as external', () => {
    // Regression: `//community.interledger.org/…` is a working https link, but
    // a leading-slash test reads it as the internal path `/community…`.
    expect(
      classifyHref('//community.interledger.org/kanzufinance/intro', CTX)
    ).toBeNull()
  })

  it('skips non-http schemes and external hosts', () => {
    expect(classifyHref('mailto:hi@interledger.org', CTX)).toBeNull()
    expect(classifyHref('tel:+123', CTX)).toBeNull()
    expect(classifyHref('javascript:void(0)', CTX)).toBeNull()
    expect(classifyHref('https://example.com/x', CTX)).toBeNull()
  })

  it('treats self-origin absolute URLs as internal', () => {
    // Where the hreflang breakage lives — skipping these as "external" misses
    // 47 real broken links.
    expect(classifyHref('https://interledger.org/es/blog', CTX)).toEqual({
      pathname: '/es/blog',
      fragment: null,
      malformed: false
    })
    expect(classifyHref('https://www.interledger.org/about-us/', CTX)).toEqual({
      pathname: '/about-us',
      fragment: null,
      malformed: false
    })
    expect(classifyHref('http://interledger.org/es/blog', CTX)).toEqual({
      pathname: '/es/blog',
      fragment: null,
      malformed: false
    })
  })

  it('drops the query string but keeps the fragment', () => {
    expect(classifyHref('/contact/?success=true', CTX)).toEqual({
      pathname: '/contact',
      fragment: null,
      malformed: false
    })
    expect(classifyHref('/a/?x=1#frag', CTX)).toEqual({
      pathname: '/a',
      fragment: 'frag',
      malformed: false
    })
  })

  it('resolves bare fragments against the current page', () => {
    expect(classifyHref('#section', CTX)).toEqual({
      pathname: '/blog/post',
      fragment: 'section',
      malformed: false
    })
    expect(classifyHref('#', CTX)?.fragment).toBe('')
  })

  it('resolves relative links against the current page', () => {
    expect(classifyHref('../other', CTX)?.pathname).toBe('/other')
    expect(classifyHref('./sibling', CTX)?.pathname).toBe('/blog/sibling')
  })

  it('ignores runtime endpoints', () => {
    expect(
      classifyHref('/.netlify/images?url=%2Fimg%2Fh.png&#38;w=640', CTX)
    ).toBeNull()
  })

  it('flags an undecodable path rather than silently passing it', () => {
    expect(classifyHref('/a%2', CTX)?.malformed).toBe(true)
  })

  it('decodes percent-encoded paths and fragments', () => {
    expect(classifyHref('/es/blog/a%20b#secci%C3%B3n', CTX)).toEqual({
      pathname: '/es/blog/a b',
      fragment: 'sección',
      malformed: false
    })
  })

  it('preserves case', () => {
    expect(classifyHref('/Blog/Post', CTX)?.pathname).toBe('/Blog/Post')
  })
})

describe('normalizeInternalPath', () => {
  it('collapses trailing slashes but keeps root', () => {
    expect(normalizeInternalPath('/a/')).toBe('/a')
    expect(normalizeInternalPath('/a')).toBe('/a')
    expect(normalizeInternalPath('/')).toBe('/')
  })
})

describe('distFileToTargets', () => {
  it('maps directory-format pages to their pretty path', () => {
    expect(distFileToTargets('about-us/index.html')).toEqual(
      expect.arrayContaining(['/about-us', '/about-us/index.html'])
    )
  })

  it('maps the root index to /', () => {
    expect(distFileToTargets('index.html')).toEqual(
      expect.arrayContaining(['/', '/index.html'])
    )
  })

  it('exposes extensionless resolution for non-index html', () => {
    expect(distFileToTargets('404.html')).toEqual(
      expect.arrayContaining(['/404', '/404.html'])
    )
  })

  it('indexes assets literally and decoded', () => {
    expect(distFileToTargets('img/a.png')).toEqual(['/img/a.png'])
    expect(distFileToTargets('img/a%20b.png')).toEqual(
      expect.arrayContaining(['/img/a%20b.png', '/img/a b.png'])
    )
  })
})

describe('scanDocument', () => {
  it('reads every link carrier', () => {
    const html = `
      <a href="/a">x</a>
      <img src="/b.png">
      <form action="/c"></form>
      <video poster="/d.jpg"></video>
      <link rel="alternate" hreflang="es" href="/es/a">`
    expect(extractLinkTargets(html)).toEqual(
      expect.arrayContaining(['/a', '/b.png', '/c', '/d.jpg', '/es/a'])
    )
  })

  it('splits srcset and strips descriptors', () => {
    const html = `<img srcset="/a-640.png 640w, /a-1280.png 1280w">`
    expect(extractLinkTargets(html)).toEqual(['/a-640.png', '/a-1280.png'])
  })

  it('never reads data-* attributes', () => {
    // data-umami-event-link-text holds free prose; scanning it produces
    // phantom schemes and phantom fragments by the thousand.
    const html = `<a href="/real" data-umami-event-link-text="#hashtag chat" data-component="/fake">x</a>`
    expect(extractLinkTargets(html)).toEqual(['/real'])
  })

  it('reads a value containing the other quote character', () => {
    // A naive ["']([^"']*)["'] stops at the apostrophe and reports the
    // truncated path as broken, failing the build on a link nobody wrote.
    const html = `<a href="/blog/it's-complicated">x</a><img src="/uploads/anna's-headshot.png">`
    expect(extractLinkTargets(html)).toEqual([
      "/blog/it's-complicated",
      "/uploads/anna's-headshot.png"
    ])
  })

  it('collects ids from any tag and name only from anchors', () => {
    const html = `
      <h2 id="heading">x</h2>
      <a name="legacy"></a>
      <input name="email">
      <meta name="description" content="x">`
    const ids = extractAnchorIds(html)
    expect(ids).toContain('heading')
    expect(ids).toContain('legacy')
    expect(ids).not.toContain('email')
    expect(ids).not.toContain('description')
  })
})

describe('parseNetlifyRedirectRules', () => {
  it('extracts the from of each redirects block', () => {
    const toml = `
[build]
  command = "pnpm build"

[[redirects]]
  from = "/summit/:year/talk/:slug"
  to = "/summit/:year/talks/:slug"

[[redirects]]
  from = "/es/summit/:year/talk/:slug"
  to = "/es/summit/:year/talks/:slug"
`
    expect(parseNetlifyRedirectRules(toml)).toEqual([
      '/summit/:year/talk/:slug',
      '/es/summit/:year/talk/:slug'
    ])
  })

  it('returns nothing when there are no redirect blocks', () => {
    expect(parseNetlifyRedirectRules('[build]\n  command = "x"\n')).toEqual([])
  })

  it('parses the real netlify.toml', async () => {
    const { readFile } = await import('node:fs/promises')
    const toml = await readFile(
      new URL('../../netlify.toml', import.meta.url),
      'utf8'
    )
    expect(parseNetlifyRedirectRules(toml).length).toBeGreaterThan(0)
  })
})

describe('netlifyRuleToMatcher', () => {
  it('matches one segment per :param', () => {
    const rule = netlifyRuleToMatcher('/summit/:year/talk/:slug')
    expect(rule.test('/summit/2025/talk/rafiki')).toBe(true)
    expect(rule.test('/summit/2025/talk/rafiki/')).toBe(true)
    // A :param must not swallow a slash, or the rule covers paths Netlify
    // would never redirect.
    expect(rule.test('/summit/2025/talk/a/b')).toBe(false)
    expect(rule.test('/summit/2025/talks/rafiki')).toBe(false)
  })

  it('treats * as a splat', () => {
    expect(netlifyRuleToMatcher('/old/*').test('/old/a/b/c')).toBe(true)
  })
})

describe('partitionRoutes', () => {
  const route = (over: Partial<ResolvedRouteInput>): ResolvedRouteInput => ({
    pattern: '/x',
    params: [],
    type: 'page',
    isPrerendered: true,
    ...over
  })

  it('collects literal redirect sources and SSR routes', () => {
    const { redirects, ssr } = partitionRoutes([
      route({ pattern: '/home', type: 'redirect' }),
      route({ pattern: '/tech/roadmap', isPrerendered: false }),
      route({ pattern: '/about-us' })
    ])
    expect([...redirects]).toEqual(['/home'])
    expect([...ssr]).toEqual(['/tech/roadmap'])
  })

  it('drops dynamic routes entirely', () => {
    // The load-bearing exclusion: a dynamic route's pathname is undefined here,
    // and its patternRegex matches far more than it should.
    const { redirects, ssr } = partitionRoutes([
      route({ pattern: '/[...page]', params: ['page'], isPrerendered: false }),
      route({ pattern: '/blog/[id]', params: ['id'] })
    ])
    expect(redirects.size).toBe(0)
    expect(ssr.size).toBe(0)
  })
})

describe('resolveTarget', () => {
  const index: TargetIndex = {
    files: new Map([['/about-us', 'about-us/index.html']]),
    redirects: new Set(['/home']),
    ssr: new Set(['/tech/roadmap']),
    netlifyRules: [netlifyRuleToMatcher('/summit/:year/talk/:slug')]
  }

  it('resolves through each layer', () => {
    expect(resolveTarget(index, '/about-us')).toBe('file')
    expect(resolveTarget(index, '/home')).toBe('redirect')
    expect(resolveTarget(index, '/tech/roadmap')).toBe('ssr')
    expect(resolveTarget(index, '/summit/2025/talk/x')).toBe('netlify-redirect')
    expect(resolveTarget(index, '/robots.txt')).toBe('allowed')
  })

  it('does not allowlist the sitemap, which is a real file by then', () => {
    // Allowlisting it would short-circuit the file check and hide a sitemap
    // that stopped being generated.
    expect(resolveTarget(index, '/sitemap-index.xml')).toBe('none')
  })

  it('reports anything else as unresolvable', () => {
    expect(resolveTarget(index, '/node/1365')).toBe('none')
  })
})

describe('formatFindings', () => {
  it('truncates at 25 with an overflow note', () => {
    const entries = Array.from({ length: 30 }, (_, i): [string, Finding] => [
      `/x${i}`,
      { reason: 'missing-page', file: 'a.html', count: 1 }
    ])
    const out = formatFindings(entries)
    expect(out).toContain('…and 5 more')
    expect(out.split('\n').filter((l) => l.startsWith('  - '))).toHaveLength(25)
  })
})

/**
 * Below: the real hooks, run against a temp directory standing in for `dist/`.
 * The helpers above only classify a link; `astro:build:done` decides whether a
 * classification fails the build.
 */
type Hooks = ReturnType<typeof validateInternalLinks>['hooks']

interface CheckRun {
  info: string[]
  warn: string[]
  error: Error | null
}

let tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))
  )
  tempDirs = []
})

async function runCheck(
  files: Record<string, string>,
  routes: ResolvedRouteInput[] = []
): Promise<CheckRun> {
  const distDir = await mkdtemp(path.join(tmpdir(), 'link-check-'))
  tempDirs.push(distDir)

  for (const [name, contents] of Object.entries(files)) {
    const full = path.join(distDir, name)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, contents)
  }

  const integration = validateInternalLinks()
  const hooks = integration.hooks as Required<Hooks>
  const info: string[] = []
  const warn: string[] = []

  await hooks['astro:config:done']({
    config: { site: 'https://interledger.org' }
  } as never)
  await hooks['astro:routes:resolved']({ routes } as never)

  let error: Error | null = null
  try {
    await hooks['astro:build:done']({
      dir: pathToFileURL(`${distDir}/`),
      logger: {
        info: (message: string) => info.push(message),
        warn: (message: string) => warn.push(message)
      }
    } as never)
  } catch (err) {
    error = err as Error
  }

  return { info, warn, error }
}

const ssrRoute = (pattern: string): ResolvedRouteInput => ({
  pattern,
  params: [],
  type: 'page',
  isPrerendered: false
})

const catchAllRoute = (): ResolvedRouteInput => ({
  pattern: '/[...page]',
  params: ['page'],
  type: 'page',
  isPrerendered: true
})

describe('validateInternalLinks', () => {
  it('passes a clean tree', async () => {
    const { error, info } = await runCheck({
      'index.html': '<a href="/about-us">about</a>',
      'about-us/index.html': '<a href="/">home</a>'
    })
    expect(error).toBeNull()
    expect(info.join('\n')).toContain('all resolve')
  })

  it('fails on a dead page link', async () => {
    const { error } = await runCheck({
      'index.html': '<a href="/node/1365">drupal</a>'
    })
    expect(error?.message).toContain('/node/1365')
    expect(error?.message).toContain('no page, redirect, or SSR route')
  })

  it('is not neutered by a prerendered catch-all route', async () => {
    // The most important test here. `/[...page]` compiles to a regex matching
    // every path; if the resolver ever consults route patterns, this passes and
    // the check is worthless from then on.
    const { error } = await runCheck(
      { 'index.html': '<a href="/definitely-not-a-page">x</a>' },
      [catchAllRoute()]
    )
    expect(error?.message).toContain('/definitely-not-a-page')
  })

  it('accepts a link to an SSR route that emits no HTML', async () => {
    const { error } = await runCheck(
      { 'index.html': '<a href="/tech/roadmap">roadmap</a>' },
      [ssrRoute('/tech/roadmap')]
    )
    expect(error).toBeNull()
  })

  it('accepts a link that only a redirect resolves', async () => {
    const { error } = await runCheck(
      { 'index.html': '<a href="/home">home</a>' },
      [
        {
          pattern: '/home',
          params: [],
          type: 'redirect',
          isPrerendered: true
        }
      ]
    )
    expect(error).toBeNull()
  })

  it('fails on an undecodable URL', async () => {
    // classifyHref only flags it; without this, the whole malformed-url reason
    // could be deleted from the hook and every test would still pass.
    const { error } = await runCheck({
      'index.html': '<a href="/a%2">x</a>'
    })
    expect(error?.message).toContain('/a%2')
    expect(error?.message).toContain('malformed URL')
  })

  it('counts every link to a target and reports the worst first', async () => {
    // Both links to the missing upload sit on one page: the count is per
    // link, not per page, and the report leads with the highest count.
    const { error } = await runCheck({
      'index.html':
        '<img src="/uploads/gone.png"><img src="/uploads/gone.png">',
      'other/index.html': '<a href="/node/1">x</a>'
    })
    const lines = (error?.message ?? '')
      .split('\n')
      .filter((line) => line.startsWith('  - '))
    expect(lines[0]).toContain('/uploads/gone.png')
    expect(lines[0]).toContain('upload missing from this deploy')
    expect(lines[0]).toContain('2 link(s)')
    expect(lines[1]).toContain('/node/1')
  })

  it('fails on a missing asset', async () => {
    const { error } = await runCheck({
      'index.html': '<img src="/developers/img/blog/2024-08-13/network.png">'
    })
    expect(error?.message).toContain(
      '/developers/img/blog/2024-08-13/network.png'
    )
    expect(error?.message).toContain('no such file in the build')
  })

  it('fails on a dangling fragment', async () => {
    const { error } = await runCheck({
      'index.html': '<a href="/a#htlas-without-ledger-supoprt">x</a>',
      'a/index.html': '<h2 id="htlas-without-ledger-support">ok</h2>'
    })
    expect(error?.message).toContain('#htlas-without-ledger-supoprt')
    expect(error?.message).toContain('no element with that id')
  })

  it('accepts a fragment that exists, including #top and bare #', async () => {
    const { error } = await runCheck({
      'index.html':
        '<a href="/a#real">x</a><a href="#top">t</a><a href="#">b</a>',
      'a/index.html': '<h2 id="real">ok</h2>'
    })
    expect(error).toBeNull()
  })

  it('does not check fragments behind an SSR route', async () => {
    const { error, info } = await runCheck(
      { 'index.html': '<a href="/tech/roadmap#phase-2">x</a>' },
      [ssrRoute('/tech/roadmap')]
    )
    expect(error).toBeNull()
    expect(info.join('\n')).toContain('were not checked')
  })

  it('catches a broken self-origin absolute URL', async () => {
    const { error } = await runCheck({
      'index.html':
        '<link rel="alternate" hreflang="es" href="https://interledger.org/es/blog/category/all/14">'
    })
    expect(error?.message).toContain('/es/blog/category/all/14')
  })

  it('ignores external and protocol-relative links', async () => {
    const { error } = await runCheck({
      'index.html':
        '<a href="//community.interledger.org/x">a</a>' +
        '<a href="https://example.com/y">b</a>' +
        '<a href="mailto:hi@interledger.org">c</a>'
    })
    expect(error).toBeNull()
  })

  it('ignores image CDN URLs whose params are entity-encoded', async () => {
    const { error } = await runCheck({
      'index.html':
        '<img src="/.netlify/images?url=%2Fimg%2Fh.png&#38;fm=avif&#38;w=640">'
    })
    expect(error).toBeNull()
  })

  it('suppresses a target listed in INTERNAL_LINK_EXCEPTIONS', async () => {
    // Exercises the real list rather than a fixture, so an entry that stops
    // matching the audit's normalised form shows up here.
    const { error } = await runCheck({
      'index.html': '<a href="/es/404">es</a>'
    })
    expect(error).toBeNull()
  })

  it('warns about an exception whose target now resolves', async () => {
    // The link is still there, but the page it points at exists now, so the
    // entry is suppressing nothing. It has to be reported even though the
    // target is still referenced, or it sits in the list ready to hide the
    // next real breakage on that path.
    const { warn, error } = await runCheck({
      'index.html': '<a href="/es/404">es</a>',
      'es/404/index.html': '<p>no encontrado</p>'
    })
    expect(error).toBeNull()
    expect(warn.join('\n')).toContain('Stale link exception: /es/404')
  })

  it('throws when there is no HTML to scan', async () => {
    const { error } = await runCheck({ 'robots.txt': 'User-agent: *' })
    expect(error?.message).toContain('no HTML to scan')
  })

  it('skips entirely when LINK_CHECK=off', async () => {
    process.env.LINK_CHECK = 'off'
    try {
      const { error, warn } = await runCheck({
        'index.html': '<a href="/node/1365">x</a>'
      })
      expect(error).toBeNull()
      expect(warn.join('\n')).toContain('LINK_CHECK=off')
    } finally {
      delete process.env.LINK_CHECK
    }
  })
})
