import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  classifyHref,
  compileNetlifyRule,
  decodeHtmlEntities,
  distFileToTargets,
  extractAnchorIds,
  extractLinkTargets,
  findBrokenRedirects,
  formatFindings,
  isServedWithTrailingSlash,
  loadNetlifyRules,
  loadRedirectsFile,
  normalizeInternalPath,
  parseNetlifyRedirectRules,
  parseRedirectsFile,
  partitionRoutes,
  resolveTarget,
  validateInternalLinks,
  type Finding,
  type NetlifyRule,
  type ResolvedRouteInput,
  type TargetIndex
} from './validate-internal-links'

// A directory-index page: `blog/post/index.html`, which Netlify serves at
// `/blog/post/`. `servedWithTrailingSlash` only changes relative resolution.
const CTX = {
  fromPathname: '/blog/post',
  siteHost: 'interledger.org',
  servedWithTrailingSlash: true
}

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

  it('resolves relative links against the URL the browser shows', () => {
    // Netlify 301s /blog/post to /blog/post/, so the base carries the slash.
    // Resolving against the slashless form would drop `post` and give
    // /blog/sibling — a working link reported as broken, or vice versa.
    expect(classifyHref('./sibling', CTX)?.pathname).toBe('/blog/post/sibling')
    expect(classifyHref('../other', CTX)?.pathname).toBe('/blog/other')
  })

  it('resolves relative links on a page served without a trailing slash', () => {
    // `404.html` has no directory of its own, so /404 never gains a slash.
    const ctx = { ...CTX, fromPathname: '/404', servedWithTrailingSlash: false }
    expect(classifyHref('./sibling', ctx)?.pathname).toBe('/sibling')
  })

  it('does not double the slash when resolving relative to the root', () => {
    const ctx = { ...CTX, fromPathname: '/', servedWithTrailingSlash: true }
    expect(classifyHref('./sibling', ctx)?.pathname).toBe('/sibling')
  })

  it('ignores runtime endpoints', () => {
    expect(
      classifyHref('/.netlify/images?url=%2Fimg%2Fh.png&#38;w=640', CTX)
    ).toBeNull()
  })

  it('flags an undecodable path rather than silently passing it', () => {
    expect(classifyHref('/a%2', CTX)?.malformed).toBe(true)
  })

  it('ignores an empty or whitespace-only value', () => {
    // `<a href="">` is real markup; without this it would resolve to the
    // current page and report a phantom target.
    expect(classifyHref('', CTX)).toBeNull()
    expect(classifyHref('   ', CTX)).toBeNull()
  })

  it('keeps an undecodable fragment as written', () => {
    // The path decodes, so this is not `malformed`; the fragment just cannot be
    // decoded, and has to survive for the id comparison to stand a chance.
    expect(classifyHref('/a#b%2', CTX)).toEqual({
      pathname: '/a',
      fragment: 'b%2',
      malformed: false
    })
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

describe('isServedWithTrailingSlash', () => {
  it('is true only for a directory index', () => {
    expect(isServedWithTrailingSlash('about-us/index.html')).toBe(true)
    expect(isServedWithTrailingSlash('index.html')).toBe(true)
    // No directory of its own, so /404 never gains a slash.
    expect(isServedWithTrailingSlash('404.html')).toBe(false)
    expect(isServedWithTrailingSlash('img/a.png')).toBe(false)
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
      { from: '/summit/:year/talk/:slug', to: '/summit/:year/talks/:slug' },
      {
        from: '/es/summit/:year/talk/:slug',
        to: '/es/summit/:year/talks/:slug'
      }
    ])
  })

  it('records a block with no destination', () => {
    // The source still has to match, or links through it report as broken.
    expect(
      parseNetlifyRedirectRules('[[redirects]]\n  from = "/old"\n')
    ).toEqual([{ from: '/old', to: '' }])
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

describe('loadNetlifyRules', () => {
  // Both guards fail the build in every mode, so a regression here stops
  // deploys — or, worse, silently drops :param coverage and reports working
  // links as broken.
  it('compiles the rules in a readable file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'toml-'))
    tempDirs.push(dir)
    const file = path.join(dir, 'netlify.toml')
    await writeFile(
      file,
      '[[redirects]]\n  from = "/summit/:year/talk/:slug"\n'
    )

    const rules = await loadNetlifyRules(file)
    expect(rules).toHaveLength(1)
    expect(rules[0].pattern.test('/summit/2025/talk/x')).toBe(true)
  })

  it('throws when the file cannot be read', async () => {
    const missing = path.join(tmpdir(), 'no-such-netlify.toml')
    await expect(loadNetlifyRules(missing)).rejects.toThrow(
      /could not read .*no-such-netlify\.toml/
    )
  })

  it('throws when the file has no redirect rules', async () => {
    // A reorganised netlify.toml must not silently drop the :param rules: the
    // check would then report every /summit/:year/talk/:slug link as broken.
    const dir = await mkdtemp(path.join(tmpdir(), 'toml-'))
    tempDirs.push(dir)
    const file = path.join(dir, 'netlify.toml')
    await writeFile(file, '[build]\n  command = "pnpm build"\n')

    await expect(loadNetlifyRules(file)).rejects.toThrow(
      /found no \[\[redirects\]\] rules/
    )
  })
})

describe('parseRedirectsFile', () => {
  it('reads from, to and status, skipping comments and blank lines', () => {
    const text = '# comment\n\n/a    /b    301\n  /c\t/d  404  \n/e /f\n'
    expect(parseRedirectsFile(text)).toEqual([
      { from: '/a', to: '/b', status: 301 },
      { from: '/c', to: '/d', status: 404 },
      { from: '/e', to: '/f', status: 301 }
    ])
  })
})

describe('loadRedirectsFile', () => {
  it('treats a missing file as no rules', async () => {
    const missing = path.join(tmpdir(), 'no-such-dir', '_redirects')
    await expect(loadRedirectsFile(missing)).resolves.toEqual([])
  })
})

describe('compileNetlifyRule', () => {
  const substitute = (rule: NetlifyRule, pathname: string): string =>
    pathname.replace(rule.pattern, rule.replacement)

  it('matches one segment per :param', () => {
    const { pattern } = compileNetlifyRule(
      '/summit/:year/talk/:slug',
      '/summit/:year/talks/:slug'
    )
    expect(pattern.test('/summit/2025/talk/rafiki')).toBe(true)
    expect(pattern.test('/summit/2025/talk/rafiki/')).toBe(true)
    // A :param must not swallow a slash, or the rule covers paths Netlify
    // would never redirect.
    expect(pattern.test('/summit/2025/talk/a/b')).toBe(false)
    expect(pattern.test('/summit/2025/talks/rafiki')).toBe(false)
  })

  it('puts the matched values back into the destination', () => {
    const rule = compileNetlifyRule(
      '/summit/:year/talk/:slug',
      '/summit/:year/talks/:slug'
    )
    expect(substitute(rule, '/summit/2025/talk/rafiki')).toBe(
      '/summit/2025/talks/rafiki'
    )
  })

  it('treats * as a splat', () => {
    const rule = compileNetlifyRule('/old/*', '/new/:splat')
    expect(rule.pattern.test('/old/a/b/c')).toBe(true)
    expect(substitute(rule, '/old/a/b/c')).toBe('/new/a/b/c')
  })

  it('numbers groups by position, not by kind', () => {
    // A splat before a :param takes the first group; reading them in two
    // passes would swap them.
    const rule = compileNetlifyRule('/*/talk/:slug', '/:slug/under/:splat')
    expect(substitute(rule, '/a/b/talk/rafiki')).toBe('/rafiki/under/a/b')
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
      route({ pattern: '/home', type: 'redirect', redirect: '/' }),
      route({ pattern: '/tech/roadmap', isPrerendered: false }),
      route({ pattern: '/about-us' })
    ])
    expect([...redirects]).toEqual([['/home', '/']])
    expect([...ssr]).toEqual(['/tech/roadmap'])
  })

  it('reads the destination from either redirect form', () => {
    const { redirects } = partitionRoutes([
      route({ pattern: '/a', type: 'redirect', redirect: '/plain' }),
      route({
        pattern: '/b',
        type: 'redirect',
        redirect: { status: 301, destination: '/object' }
      })
    ])
    expect(redirects.get('/a')).toBe('/plain')
    expect(redirects.get('/b')).toBe('/object')
  })

  it('still records a redirect whose destination is unknown', () => {
    // Links are checked against the source, so that must resolve regardless.
    const { redirects } = partitionRoutes([
      route({ pattern: '/home', type: 'redirect' })
    ])
    expect(redirects.has('/home')).toBe(true)
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
    files: new Map([
      ['/about-us', 'about-us/index.html'],
      ['/summit/2025/talks/x', 'summit/2025/talks/x/index.html']
    ]),
    redirects: new Map([['/home', '/about-us']]),
    ssr: new Set(['/tech/roadmap']),
    netlifyRules: [
      compileNetlifyRule(
        '/summit/:year/talk/:slug',
        '/summit/:year/talks/:slug'
      )
    ]
  }

  it('resolves through each layer', () => {
    expect(resolveTarget(index, '/about-us')).toBe('file')
    expect(resolveTarget(index, '/home')).toBe('redirect')
    expect(resolveTarget(index, '/tech/roadmap')).toBe('ssr')
    expect(resolveTarget(index, '/summit/2025/talk/x')).toBe('netlify-redirect')
    expect(resolveTarget(index, '/robots.txt')).toBe('allowed')
  })

  it('rejects a netlify rule whose destination is not served', () => {
    // Matching a `from` is not a resolution: the singular URL redirects, but
    // the plural one it lands on is not in this build.
    expect(resolveTarget(index, '/summit/2025/talk/gone')).toBe('none')
  })

  it('accepts a netlify destination that resolves through another layer', () => {
    const viaRedirect: TargetIndex = {
      ...index,
      files: new Map(),
      redirects: new Map([['/summit/2025/talks/x', '/about-us']])
    }
    expect(resolveTarget(viaRedirect, '/summit/2025/talk/x')).toBe(
      'netlify-redirect'
    )
  })

  it('accepts a netlify rule that leaves the site or records no destination', () => {
    const offSite: TargetIndex = {
      ...index,
      netlifyRules: [
        compileNetlifyRule('/legacy/:slug', 'https://example.org/:slug'),
        compileNetlifyRule('/nowhere/:slug', '')
      ]
    }
    expect(resolveTarget(offSite, '/legacy/x')).toBe('netlify-redirect')
    expect(resolveTarget(offSite, '/nowhere/x')).toBe('netlify-redirect')
  })

  it('does not allowlist the sitemap, which is a real file by then', () => {
    // Allowlisting it would short-circuit the file check and hide a sitemap
    // that stopped being generated.
    expect(resolveTarget(index, '/sitemap-index.xml')).toBe('none')
  })

  it('reports anything else as unresolvable', () => {
    expect(resolveTarget(index, '/node/1365')).toBe('none')
  })

  it('treats a 404 rule as unresolved, not as its /404.html destination', () => {
    // 404.html is a real file, so following the destination would pass it.
    const withErrorRule: TargetIndex = {
      ...index,
      files: new Map([['/404.html', '404.html']]),
      netlifyRules: [compileNetlifyRule('/gone/*', '/404.html', 404)]
    }
    expect(resolveTarget(withErrorRule, '/gone/x')).toBe('none')
  })

  // Regression for the grantee-directory rules: its legacy 301s must resolve
  // and its 404 guards must not.
  describe('against the real public/_redirects', () => {
    const dir = '/grant/grantee-directory'
    const pages = [
      `${dir}/tag/accessibility`,
      `${dir}/tag/accessibility/2`,
      `${dir}/2020/tag/accessibility`,
      `/es${dir}/tag/accessibility`,
      `/es${dir}/2020/tag/accessibility`
    ]

    const realIndex = async (): Promise<TargetIndex> => ({
      files: new Map([
        ['/404.html', '404.html'],
        ...pages.map((page): [string, string] => [page, `${page}/index.html`])
      ]),
      redirects: new Map(),
      ssr: new Set(),
      netlifyRules: await loadRedirectsFile(
        fileURLToPath(new URL('../../public/_redirects', import.meta.url))
      )
    })

    it.each([
      [`${dir}/2020/tag/accessibility`, 'file'],
      [`${dir}/2020/tag/nonexistent`, 'none'],
      [`${dir}/tag/nonexistent`, 'none'],
      [`${dir}/all/accessibility`, 'netlify-redirect'],
      [`${dir}/all/accessibility/2`, 'netlify-redirect'],
      [`${dir}/2020/accessibility`, 'netlify-redirect'],
      [`/es${dir}/2020/tag/nonexistent`, 'none'],
      [`/es${dir}/all/accessibility`, 'netlify-redirect'],
      [`/es${dir}/2020/accessibility`, 'netlify-redirect']
    ])('%s → %s', async (pathname, expected) => {
      expect(resolveTarget(await realIndex(), pathname)).toBe(expected)
    })
  })
})

describe('findBrokenRedirects', () => {
  const index = (redirects: Map<string, string>): TargetIndex => ({
    files: new Map([
      ['/about-us', 'about-us/index.html'],
      ['/tech/overview', 'tech/overview/index.html']
    ]),
    redirects,
    ssr: new Set(['/tech/roadmap']),
    netlifyRules: []
  })

  it('passes a redirect whose destination resolves', () => {
    expect(findBrokenRedirects(index(new Map([['/a', '/about-us']])))).toEqual(
      []
    )
  })

  it('reports a redirect whose destination is not served', () => {
    expect(findBrokenRedirects(index(new Map([['/a', '/gone']])))).toEqual([
      ['/a', '/gone']
    ])
  })

  it('normalises a trailing slash on the destination', () => {
    // Five real destinations are written this way; the index has no slash.
    expect(
      findBrokenRedirects(index(new Map([['/a', '/tech/overview/']])))
    ).toEqual([])
  })

  it('skips an external destination', () => {
    const external = new Map([['/a', 'https://example.com/x']])
    expect(findBrokenRedirects(index(external))).toEqual([])
  })

  it('skips a redirect with no known destination', () => {
    expect(findBrokenRedirects(index(new Map([['/a', '']])))).toEqual([])
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

/**
 * Runs strict by default, so the cases below assert on what the check
 * classifies as broken rather than on the warn/fail decision. Pass
 * `{ strict: false }` to exercise the default build behaviour.
 */
async function runCheck(
  files: Record<string, string>,
  routes: ResolvedRouteInput[] = [],
  { strict = true }: { strict?: boolean } = {}
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

  const previous = process.env.LINK_CHECK
  if (strict) process.env.LINK_CHECK = 'strict'
  else delete process.env.LINK_CHECK

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
  } finally {
    if (previous === undefined) delete process.env.LINK_CHECK
    else process.env.LINK_CHECK = previous
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

  it('reads the built _redirects, where a 404 rule is not a resolution', async () => {
    const { error } = await runCheck({
      _redirects: '/old/:slug  /new/:slug  301\n/new/*  /404.html  404\n',
      '404.html': '',
      'new/a/index.html': '',
      'index.html': [
        '<a href="/old/a">legacy, lands on a page</a>',
        '<a href="/new/a">canonical, a real page wins over the 404 rule</a>',
        '<a href="/new/gone">404 rule</a>'
      ].join('')
    })
    expect(error?.message).toContain('1 do not resolve')
    expect(error?.message).toContain('/new/gone')
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

  it('does not check a fragment on a non-HTML target', async () => {
    // The file exists, so the link resolves; there is no document to read ids
    // out of, and treating that as a missing fragment would be a false alarm.
    const { error } = await runCheck({
      'index.html': '<a href="/paper.pdf#page=2">x</a>',
      'paper.pdf': '%PDF-1.4'
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

  it('resolves a relative link against the page the browser actually serves', async () => {
    // Regression: `blog/post/index.html` is served at /blog/post/, so `sibling`
    // is /blog/post/sibling. Resolving against /blog/post looked for
    // /blog/sibling and reported a working link as broken.
    const { error } = await runCheck({
      'blog/post/index.html': '<a href="sibling">next</a>',
      'blog/post/sibling/index.html': '<p>here</p>'
    })
    expect(error).toBeNull()
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

  describe('redirect destinations', () => {
    const redirectTo = (
      pattern: string,
      redirect: string
    ): ResolvedRouteInput => ({
      pattern,
      params: [],
      type: 'redirect',
      isPrerendered: true,
      redirect
    })

    it('fails when a redirect lands on nothing this deploy serves', async () => {
      const { error } = await runCheck({ 'index.html': '<p>x</p>' }, [
        redirectTo('/old', '/gone')
      ])
      expect(error?.message).toContain('/old')
      expect(error?.message).toContain('/gone')
    })

    it('exempts one by source, and does not then call it stale', async () => {
      // Nothing links to `/es/404`, so only the redirect sweep can mark it
      // used — it therefore has to run before the staleness check. Move it
      // after and this warns. Asserted per target: other entries in the real
      // INTERNAL_LINK_EXCEPTIONS are legitimately stale in this fixture.
      const { error, warn } = await runCheck({ 'index.html': '<p>x</p>' }, [
        redirectTo('/es/404', '/gone')
      ])
      expect(error).toBeNull()
      expect(warn.join('\n')).not.toContain('Stale link exception: /es/404')
    })
  })

  describe('warn vs strict', () => {
    const brokenLink = { 'index.html': '<a href="/node/1365">x</a>' }

    it('warns without failing the build by default', async () => {
      const { error, warn } = await runCheck(brokenLink, [], { strict: false })
      expect(error).toBeNull()
      expect(warn.join('\n')).toContain('/node/1365')
    })

    it('fails the build under LINK_CHECK=strict', async () => {
      const { error } = await runCheck(brokenLink)
      expect(error?.message).toContain('/node/1365')
    })

    it('still fails on a missing dist regardless of mode', async () => {
      // The zero-HTML guard means the check never ran at all, which is not a
      // finding to warn about — it makes any verdict meaningless.
      const { error } = await runCheck({ 'robots.txt': 'x' }, [], {
        strict: false
      })
      expect(error?.message).toContain('no HTML to scan')
    })
  })
})
