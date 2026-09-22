/**
 * Build-time guardrail: reports internal links that point at something this
 * deploy does not serve. Links are computed — a blog card's
 * `href`, a CMS-authored CTA, an `hreflang` — so the rendered HTML is the only
 * reliable signal; this scans `dist/**\/*.html` in `astro:build:done`.
 *
 * Off-the-shelf checkers know only files on disk, missing both redirects
 * (`redirects.ts`, `netlify.toml`) and `prerender = false` routes, which emit
 * no HTML. `astro:routes:resolved` covers both, but read it for literal SSR
 * patterns and redirect sources only: **never resolve against a route's
 * `patternRegex`** — `[...page]` compiles to a regex matching every path, so
 * one catch-all silently passes every broken link forever.
 *
 * Blind spots, neither checked nor reported — a clean run is not a whole-site
 * guarantee: `url()` in emitted CSS, `og:image`, JS-generated anchors, external
 * URLs, and anything only an SSR route renders.
 *
 * Findings warn by default and fail the build under `LINK_CHECK=strict`, which
 * only a Force Reset production publish sets — see {@link isStrict}.
 * `INTERNAL_LINK_EXCEPTIONS` permanently exempts a target, each with a comment
 * saying why.
 */
import type { AstroIntegration, IntegrationResolvedRoute } from 'astro'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addTrailingSlash,
  hasUrlScheme,
  stripTrailingSlash
} from '../utils/shared/url'
import { INTERNAL_LINK_EXCEPTIONS } from './internal-link-exceptions'

const OPEN_TAG_RE = /<[a-z][a-z0-9-]*\b[^>]*>/gi

/**
 * Attributes that actually carry a link.
 *
 * `data-*` is excluded on purpose: `data-umami-event-link-text` holds free
 * prose, which parses as phantom schemes and fragments by the thousand and
 * swamps the real candidates.
 */
const LINK_ATTRS = ['href', 'src', 'action', 'poster'] as const

/** Runtime endpoints and generated files that are never on disk as linked. */
const ALLOWED_PREFIXES = [
  '/.netlify/', // Image CDN + Functions: resolved by Netlify, never a file
  '/.well-known/'
]
/**
 * Files Netlify serves that Astro does not emit into `dist`.
 *
 * `sitemap-index.xml` is deliberately absent: this integration runs after
 * `@astrojs/sitemap`, so the file is already on disk, and allowlisting it would
 * hide a sitemap that stopped being generated.
 */
const ALLOWED_EXACT = new Set(['/_redirects', '/robots.txt'])

export type LinkFindingReason =
  | 'missing-page'
  | 'missing-asset'
  | 'missing-upload'
  | 'missing-fragment'
  | 'malformed-url'
  | 'redirect-to-missing'

const REASON_LABEL: Record<LinkFindingReason, string> = {
  'missing-page': 'no page, redirect, or SSR route',
  'missing-asset': 'no such file in the build',
  'missing-upload': 'upload missing from this deploy',
  'missing-fragment': 'no element with that id',
  'malformed-url': 'malformed URL',
  'redirect-to-missing': 'redirect lands on nothing this deploy serves'
}

const MAX_REPORTED = 25

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Compiled once per attribute name. `getAttr` runs seven times per tag over
 * ~1GB of HTML, and the pattern depends only on the name — compiling it per
 * call costs about a quarter of the whole check.
 */
const ATTR_PATTERNS = new Map<string, RegExp>()

function attrPattern(name: string): RegExp {
  const cached = ATTR_PATTERNS.get(name)
  if (cached) return cached
  // Keyed on whichever quote opened the value: a double-quoted value can hold
  // an apostrophe — `href="/blog/it's-complicated"` — and a naive
  // `["'][^"']*["']` stops dead at it, truncating the path.
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  ATTR_PATTERNS.set(name, pattern)
  return pattern
}

/**
 * Forces a flat copy of a string cut out of a larger one.
 *
 * A V8 substring is a view onto its parent, so an id kept past its own page's
 * scan holds that page's whole HTML. `pageIds` keeps ids for every page, so
 * without this the check pins ~1GB of `dist` and OOMs the Netlify build.
 */
function detachFromParent(value: string): string {
  return Buffer.from(value, 'utf8').toString('utf8')
}

function getAttr(tag: string, name: string): string | null {
  const match = tag.match(attrPattern(name))
  if (!match) return null
  const value = match[1] ?? match[2] ?? null
  return value === null ? null : detachFromParent(value)
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

/**
 * Decodes HTML entities in an attribute value.
 *
 * Must run *before* a URL is split on `#` or `?`: `&#38;` contains a literal
 * `#`, and every `/.netlify/images` URL separates its params with it, so
 * skipping this makes them all appear to carry a fragment.
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi,
    (whole, body: string) => {
      if (!body.startsWith('#')) {
        return NAMED_ENTITIES[body.toLowerCase()] ?? whole
      }
      const isHex = body[1] === 'x' || body[1] === 'X'
      const code = Number.parseInt(
        isHex ? body.slice(2) : body.slice(1),
        isHex ? 16 : 10
      )
      try {
        return String.fromCodePoint(code)
      } catch {
        // Out of Unicode range, or so many digits it parsed as Infinity —
        // either way, leave the entity as written.
        return whole
      }
    }
  )
}

/** `decodeURIComponent` that returns the input rather than throwing. */
function decodeOrSelf(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Normalises a path for comparison: no trailing slash (except root).
 *
 * Astro's default `trailingSlash: 'ignore'` serves both `/contact` and
 * `/contact/`, and the build writes targets both ways, so collapsing them keeps
 * one link from looking like two. Case is preserved deliberately: macOS is
 * case-insensitive and Netlify is not, so folding it would let a `/Blog` typo
 * pass locally and 404 in production.
 */
export function normalizeInternalPath(pathname: string): string {
  return stripTrailingSlash(pathname)
}

export interface ClassifiedLink {
  /** Normalised path of the target document. */
  pathname: string
  /** Decoded fragment without `#`, or null when the link carries none. */
  fragment: string | null
  /** The URL could not be percent-decoded — a genuine authoring bug. */
  malformed: boolean
}

export interface ClassifyContext {
  /** Normalised path of the page the link was found on. */
  fromPathname: string
  /** Origin host from `config.site`, e.g. `interledger.org`. */
  siteHost: string
  /** Whether the page's own URL ends in `/`. Only relative links care. */
  servedWithTrailingSlash: boolean
}

/**
 * Turns a raw attribute value into an internal target, or `null` when the link
 * is out of scope (external, `mailto:`, a runtime endpoint, …).
 *
 * Order matters throughout; see the inline notes.
 */
export function classifyHref(
  raw: string,
  { fromPathname, siteHost, servedWithTrailingSlash }: ClassifyContext
): ClassifiedLink | null {
  const value = decodeHtmlEntities(raw).trim()
  if (!value) return null

  // A bare fragment resolves against the page it sits on.
  if (value.startsWith('#')) {
    return {
      pathname: fromPathname,
      fragment: decodeOrSelf(value.slice(1)),
      malformed: false
    }
  }

  // Protocol-relative `//host/path` is external, and must be tested before the
  // leading-slash check or it reads as the internal path `/host/path`.
  if (value.startsWith('//')) return null

  let working = value

  if (hasUrlScheme(value)) {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      return null
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    // Self-origin absolute URLs are internal links written the long way:
    // canonical, og:url and hreflang alternates are all emitted this way.
    const host = url.host.replace(/^www\./, '')
    if (host !== siteHost.replace(/^www\./, '')) return null
    working = `${url.pathname}${url.search}${url.hash}`
  } else if (!value.startsWith('/')) {
    // Relative link. The base is the URL as served, not the normalised lookup
    // key: without the trailing slash `new URL` drops the last segment, so
    // `comments` on `/about-us/` would resolve to `/comments`.
    const base = servedWithTrailingSlash
      ? addTrailingSlash(fromPathname)
      : fromPathname
    try {
      const resolved = new URL(value, `https://${siteHost}${base}`)
      working = `${resolved.pathname}${resolved.search}${resolved.hash}`
    } catch {
      return null
    }
  }

  const hashIndex = working.indexOf('#')
  const rawFragment = hashIndex === -1 ? null : working.slice(hashIndex + 1)
  const beforeHash = hashIndex === -1 ? working : working.slice(0, hashIndex)

  // A query string is never part of a static target: `/contact/?success=true`
  // is served by the same file as `/contact`.
  const queryIndex = beforeHash.indexOf('?')
  const rawPath =
    queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex)

  if (ALLOWED_PREFIXES.some((prefix) => rawPath.startsWith(prefix))) return null

  // One decode, not two: whether it threw is exactly what `malformed` means.
  let pathname = rawPath
  let malformed = false
  try {
    pathname = decodeURIComponent(rawPath)
  } catch {
    malformed = true
  }

  return {
    pathname: normalizeInternalPath(pathname),
    fragment: rawFragment === null ? null : decodeOrSelf(rawFragment),
    malformed
  }
}

interface DocumentScan {
  /** Every raw link-carrying attribute value found. */
  targets: string[]
  /** Every fragment target the document offers. */
  ids: Set<string>
}

/**
 * Single pass over a document's open tags for both links and fragment targets —
 * one rather than two because this runs over ~1GB of HTML.
 * `extractLinkTargets` and `extractAnchorIds` are the exported halves.
 */
function scanDocument(html: string): DocumentScan {
  const targets: string[] = []
  const ids = new Set<string>()

  for (const tag of html.match(OPEN_TAG_RE) ?? []) {
    for (const attr of LINK_ATTRS) {
      const value = getAttr(tag, attr)
      if (value) targets.push(value)
    }

    // `srcset` is comma-separated with `640w` / `2x` descriptors attached.
    const srcset = getAttr(tag, 'srcset')
    if (srcset) {
      for (const candidate of srcset.split(',')) {
        const url = candidate.trim().split(/\s+/)[0]
        if (url) targets.push(url)
      }
    }

    const id = getAttr(tag, 'id')
    if (id) ids.add(id)

    // `name` is a fragment target only on an anchor; on <input> or <meta> it
    // means something else, and counting it would hide real breakage.
    if (/^<a\b/i.test(tag)) {
      const name = getAttr(tag, 'name')
      if (name) ids.add(name)
    }
  }

  return { targets, ids }
}

export function extractLinkTargets(html: string): string[] {
  return scanDocument(html).targets
}

export function extractAnchorIds(html: string): Set<string> {
  return scanDocument(html).ids
}

export interface NetlifyRedirect {
  from: string
  to: string
}

/**
 * Extracts the `from` and `to` of each `[[redirects]]` block in a
 * `netlify.toml`. Hand-rolled because four rules in a file we own don't justify
 * a TOML parser.
 */
export function parseNetlifyRedirectRules(toml: string): NetlifyRedirect[] {
  const rules: NetlifyRedirect[] = []
  for (const block of toml.split(/\[\[redirects\]\]/).slice(1)) {
    // Stop at the next table header so a `from` further down the file can't be
    // attributed to this block.
    const scoped = block.split(/\n\s*\[/)[0]
    const from = scoped.match(/^\s*from\s*=\s*"([^"]*)"/m)
    if (!from) continue
    const to = scoped.match(/^\s*to\s*=\s*"([^"]*)"/m)
    rules.push({ from: from[1], to: to?.[1] ?? '' })
  }
  return rules
}

export interface NetlifyRule {
  /** Matches the rule's `from`, capturing one group per `:param` and `*`. */
  pattern: RegExp
  /** The `to` with each `:param` rewritten to the `$n` group it came from. */
  replacement: string
}

/**
 * Compiles a Netlify redirect into a matcher for its `from` and a substitution
 * for its `to`.
 *
 * `:param` matches exactly one segment — `/summit/:year/talk/:slug` must not
 * swallow `/summit/2025/talk/a/b` — while a `*` splat matches the rest. Both
 * capture, so a path that matched can be turned back into its destination.
 */
export function compileNetlifyRule(from: string, to: string): NetlifyRule {
  const params: string[] = []
  const body = from
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // One pass over both token kinds, so `params` stays in capture-group order.
    .replace(/\*|:[A-Za-z_][A-Za-z0-9_]*/g, (token) => {
      if (token === '*') {
        params.push('splat')
        return '(.*)'
      }
      params.push(token.slice(1))
      return '([^/]+)'
    })

  const replacement = to.replace(
    /:[A-Za-z_][A-Za-z0-9_]*/g,
    (token) => `$${params.indexOf(token.slice(1)) + 1}`
  )

  return { pattern: new RegExp(`^${body}/?$`), replacement }
}

// ---------------------------------------------------------------------------
// Target index
// ---------------------------------------------------------------------------

/**
 * Every path a dist file answers to: `about-us/index.html` serves `/about-us`
 * and itself, and Netlify serves `/404` from `404.html` — hence several keys
 * per file.
 */
export function distFileToTargets(relPath: string): string[] {
  const posix = relPath.split(path.sep).join('/')
  const out = new Set<string>()

  out.add(normalizeInternalPath(`/${posix}`))

  if (posix === 'index.html') {
    out.add('/')
  } else if (posix.endsWith('/index.html')) {
    out.add(normalizeInternalPath(`/${posix.slice(0, -'/index.html'.length)}`))
  } else if (posix.endsWith('.html')) {
    // Netlify's extensionless resolution: /404 → 404.html.
    out.add(normalizeInternalPath(`/${posix.slice(0, -'.html'.length)}`))
  }

  for (const target of [...out]) {
    const decoded = decodeOrSelf(target)
    if (decoded !== target) out.add(decoded)
  }

  return [...out]
}

/**
 * Whether this dist file is served with a trailing slash.
 *
 * `about-us/index.html` is served at `/about-us/`, but a bare `404.html` is
 * served at `/404` — hence reading the file shape rather than assuming.
 */
export function isServedWithTrailingSlash(relPath: string): boolean {
  return path.basename(relPath) === 'index.html'
}

export interface TargetIndex {
  /** Normalised target → dist-relative file path. */
  files: Map<string, string>
  /** Literal redirect source → destination, from `redirects.ts` via the route table. */
  redirects: Map<string, string>
  /** Literal `prerender = false` route patterns. */
  ssr: Set<string>
  /** Compiled `netlify.toml` `:param` rules. */
  netlifyRules: NetlifyRule[]
}

export type ResolutionKind =
  | 'file'
  | 'redirect'
  | 'ssr'
  | 'netlify-redirect'
  | 'allowed'
  | 'none'

export function resolveTarget(
  index: TargetIndex,
  pathname: string
): ResolutionKind {
  if (ALLOWED_EXACT.has(pathname)) return 'allowed'
  if (index.files.has(pathname)) return 'file'
  if (index.redirects.has(pathname)) return 'redirect'
  if (index.ssr.has(pathname)) return 'ssr'

  const rule = index.netlifyRules.find(({ pattern }) => pattern.test(pathname))
  if (!rule) return 'none'

  // Matching a `from` only moves the question along, so the destination is
  // checked like any other redirect's. `findBrokenRedirects` cannot cover these
  // — a `:param` source is a pattern, not an entry it could walk — so a link
  // arriving here is the only moment the concrete destination is knowable.
  const to = pathname.replace(rule.pattern, rule.replacement)
  // No destination recorded, or it leaves the site — nothing to resolve.
  if (!to || hasUrlScheme(to)) return 'netlify-redirect'
  return resolveTarget(index, normalizeInternalPath(to)) === 'none'
    ? 'none'
    : 'netlify-redirect'
}

/**
 * Redirects whose destination this deploy does not serve, as `[from, to]`.
 *
 * Every redirect is checked, not just linked ones — nothing links to most of
 * them. Chains fall out for free: each hop is its own entry.
 */
export function findBrokenRedirects(index: TargetIndex): [string, string][] {
  const broken: [string, string][] = []
  for (const [from, to] of index.redirects) {
    // No destination recorded, or it leaves the site — nothing to resolve.
    if (!to || hasUrlScheme(to)) continue
    if (resolveTarget(index, normalizeInternalPath(to)) === 'none') {
      broken.push([from, to])
    }
  }
  return broken
}

/**
 * The fields of a resolved route this check reads. Naming the subset keeps `patternRegex`
 * out of reach and lets a test build a route without faking Astro's dozen other fields.
 */
export type ResolvedRouteInput = Pick<
  IntegrationResolvedRoute,
  'pattern' | 'params' | 'type' | 'isPrerendered' | 'redirect'
>

/**
 * Splits the resolved route table into the two literal sets worth trusting.
 * Dynamic routes are dropped wholesale (see the module comment); their
 * `pathname` is `undefined` before `getStaticPaths()` runs anyway.
 */
export function partitionRoutes(routes: readonly ResolvedRouteInput[]): {
  redirects: Map<string, string>
  ssr: Set<string>
} {
  const redirects = new Map<string, string>()
  const ssr = new Set<string>()

  for (const route of routes) {
    if (route.params.length > 0) continue
    const pattern = normalizeInternalPath(route.pattern)
    if (route.type === 'redirect') {
      // Not `redirectRoute`: Astro matches that against lowercased, slashless
      // keys, so it is undefined for a destination written with a slash.
      const to =
        typeof route.redirect === 'string'
          ? route.redirect
          : route.redirect?.destination
      // Added either way — links resolve against the source, destination or not.
      redirects.set(pattern, to ?? '')
    } else if (!route.isPrerendered) {
      ssr.add(pattern)
    }
  }

  return { redirects, ssr }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface Finding {
  reason: LinkFindingReason
  /** A page the bad link appears on, or the destination of a broken redirect. */
  file: string
  count: number
}

function classifyMissingReason(pathname: string): LinkFindingReason {
  if (pathname.startsWith('/uploads/')) return 'missing-upload'
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
  return lastSegment.includes('.') ? 'missing-asset' : 'missing-page'
}

/** One line per distinct target, truncated with an overflow note. */
export function formatFindings(entries: Array<[string, Finding]>): string {
  const lines = entries.slice(0, MAX_REPORTED).map(([target, finding]) => {
    const { reason, file, count } = finding
    // A redirect has no occurrences to count — `file` is where it points.
    const detail =
      reason === 'redirect-to-missing'
        ? `→ ${file}`
        : `${count} link(s), e.g. ${file}`
    return `  - ${target} (${REASON_LABEL[reason]}, ${detail})`
  })
  const overflow =
    entries.length > MAX_REPORTED
      ? `\n  …and ${entries.length - MAX_REPORTED} more`
      : ''
  return lines.join('\n') + overflow
}

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

async function collectFiles(dir: string, base = dir): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full, base)))
    } else {
      out.push(path.relative(base, full))
    }
  }
  return out
}

/**
 * Whether a finding fails the build rather than warning.
 *
 * Warn by default: editors commit to `staging` with no PR and fix most of their
 * own broken links, so failing there costs more than it prevents. Only Force
 * Reset sets strict, and it runs before the force-push — so a finding stops the
 * publish rather than breaking production.
 */
function isStrict(): boolean {
  return process.env.LINK_CHECK === 'strict'
}

/** A fragment that always resolves, per the HTML spec. */
function isAlwaysValidFragment(fragment: string): boolean {
  return fragment === '' || fragment.toLowerCase() === 'top'
}

export function validateInternalLinks(): AstroIntegration {
  let siteHost = 'localhost'
  let routeRedirects = new Set<string>()
  let routeSsr = new Set<string>()

  return {
    name: 'validate-internal-links',
    hooks: {
      'astro:config:done': ({ config }) => {
        if (config.site) siteHost = new URL(config.site).host
      },

      'astro:routes:resolved': ({ routes }) => {
        const partitioned = partitionRoutes(routes)
        routeRedirects = partitioned.redirects
        routeSsr = partitioned.ssr
      },

      'astro:build:done': async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir)
        const allFiles = await collectFiles(distDir)
        const htmlFiles = allFiles.filter((file) => file.endsWith('.html'))

        // A guardrail that scanned nothing would report a clean build it never
        // looked at, and it fails silently exactly when it matters — a changed
        // output layout, or a `dir` that no longer points at the pages.
        if (htmlFiles.length === 0) {
          throw new Error(
            `Internal link validation found no HTML to scan under ${distDir}.\n` +
              `The check cannot vouch for a build it never read — check the build output layout.`
          )
        }

        const netlifyRules = await loadNetlifyRules()

        const files = new Map<string, string>()
        for (const relPath of allFiles) {
          for (const target of distFileToTargets(relPath)) {
            if (!files.has(target)) files.set(target, relPath)
          }
        }

        const index: TargetIndex = {
          files,
          redirects: routeRedirects,
          ssr: routeSsr,
          netlifyRules
        }

        // Deduped up front: 218k raw occurrences collapse to ~3.2k unique
        // targets, so everything downstream stays flat regardless of site size.
        const refs = new Map<
          string,
          ClassifiedLink & { file: string; count: number }
        >()
        // Keyed by file, not by target: one file answers to several targets
        // (`/about`, `/about/index.html`) and a fragment must validate on any.
        const pageIds = new Map<string, Set<string>>()

        for (const relPath of htmlFiles) {
          const html = await readFile(path.join(distDir, relPath), 'utf8')
          const { targets, ids } = scanDocument(html)

          const [ownPath] = distFileToTargets(relPath).sort(
            (a, b) => a.length - b.length
          )
          const servedWithTrailingSlash = isServedWithTrailingSlash(relPath)
          pageIds.set(relPath, ids)

          for (const raw of targets) {
            const link = classifyHref(raw, {
              fromPathname: ownPath,
              siteHost,
              servedWithTrailingSlash
            })
            if (!link) continue

            const key = link.fragment
              ? `${link.pathname}#${link.fragment}`
              : link.pathname
            const existing = refs.get(key)
            if (existing) {
              existing.count += 1
            } else {
              refs.set(key, { ...link, file: relPath, count: 1 })
            }
          }
        }

        const exceptions = new Set<string>(INTERNAL_LINK_EXCEPTIONS)
        const usedExceptions = new Set<string>()

        const findings = new Map<string, Finding>()
        let fragmentsSkipped = 0

        for (const [key, ref] of refs) {
          // Consulted at record time, not before resolution: an exception whose
          // target resolves never lands here, so it reports as stale below.
          const record = (reason: LinkFindingReason): void => {
            if (exceptions.has(key)) {
              usedExceptions.add(key)
              return
            }
            findings.set(key, { reason, file: ref.file, count: ref.count })
          }

          if (ref.malformed) {
            record('malformed-url')
            continue
          }

          const kind = resolveTarget(index, ref.pathname)
          if (kind === 'none') {
            record(classifyMissingReason(ref.pathname))
            continue
          }

          if (!ref.fragment || isAlwaysValidFragment(ref.fragment)) continue

          // Fragments are only checkable on a document we rendered. Behind a
          // redirect or an SSR route there is no HTML to read ids out of.
          if (kind !== 'file') {
            fragmentsSkipped += ref.count
            continue
          }

          const relPath = index.files.get(ref.pathname)
          const ids = relPath ? pageIds.get(relPath) : undefined
          if (!ids) {
            // Resolved to a non-HTML file — an asset with a fragment. Nothing
            // to validate.
            continue
          }
          if (!ids.has(ref.fragment) && !ids.has(decodeOrSelf(ref.fragment))) {
            record('missing-fragment')
          }
        }

        // Must run before the stale sweep below, or an exempted redirect
        // reports as stale.
        for (const [from, to] of findBrokenRedirects(index)) {
          // Matched on the source. `exceptions` is the same set the link loop
          // uses, so listing the destination would also silence direct links.
          if (exceptions.has(from)) {
            usedExceptions.add(from)
            continue
          }
          findings.set(from, {
            reason: 'redirect-to-missing',
            file: to,
            count: 1
          })
        }

        for (const target of exceptions) {
          if (usedExceptions.has(target)) continue
          logger.warn(
            `Stale link exception: ${target} is not a broken link in this ` +
              `build — it resolves, or nothing links to it. Remove it from ` +
              `internal-link-exceptions.ts.`
          )
        }

        // State coverage alongside every verdict, clean or not. A bare
        // all-clear reads as a whole-site guarantee, which this cannot give,
        // and a bare finding list says nothing about what went unchecked.
        const scanned =
          `${htmlFiles.length} HTML file(s), ${refs.size} unique internal target(s) ` +
          `(href, src, srcset, action, poster; fragments included)`
        const skipped = fragmentsSkipped
          ? ` ${fragmentsSkipped} fragment(s) behind a redirect or SSR route were not checked.`
          : ''

        if (findings.size === 0) {
          logger.info(`${scanned} — all resolve.${skipped}`)
          return
        }

        const entries = [...findings.entries()].sort(
          ([, a], [, b]) => b.count - a.count
        )

        const report =
          `${scanned} — ${findings.size} do not resolve.${skipped}\n` +
          `Fix the link or the redirect's destination, add a redirect in ` +
          `redirects.ts, or add an entry to ` +
          `src/integrations/internal-link-exceptions.ts with a comment saying why.\n` +
          formatFindings(entries)

        if (!isStrict()) {
          logger.warn(
            `${report}\nThis build still succeeds, but publishing to ` +
              `production will fail until these are fixed.`
          )
          return
        }

        throw new Error(`Internal link validation failed: ${report}`)
      }
    }
  }
}

const NETLIFY_TOML_PATH = fileURLToPath(
  new URL('../../netlify.toml', import.meta.url)
)

/**
 * Both guards here fail the build in every mode, so they take the path as a
 * parameter — otherwise the only way to reach them is to break the real
 * `netlify.toml`.
 */
export async function loadNetlifyRules(
  tomlPath: string = NETLIFY_TOML_PATH
): Promise<NetlifyRule[]> {
  let toml: string
  try {
    toml = await readFile(tomlPath, 'utf8')
  } catch (cause) {
    throw new Error(
      `Internal link validation could not read ${tomlPath}. Its [[redirects]] rules ` +
        `carry the only :param redirects on the site, so skipping them would report ` +
        `working links as broken.`,
      { cause }
    )
  }

  const rules = parseNetlifyRedirectRules(toml)

  // Same doctrine as the zero-HTML guard: a reorganised netlify.toml must not
  // silently drop /summit/:year/talk/:slug coverage.
  if (rules.length === 0) {
    throw new Error(
      `Internal link validation found no [[redirects]] rules in ${tomlPath}. ` +
        `Either they moved, or the parser needs updating — both make this check wrong.`
    )
  }

  return rules.map(({ from, to }) => compileNetlifyRule(from, to))
}
