import { defaultLocale, locales } from './locales'
import { ROUTE_BASES } from './routes'
import type { SiteSection } from './static-paths'
import { stripTrailingSlash } from '../shared/url'

const localePrefixes = locales.filter((locale) => locale !== defaultLocale)

const HACKATHON_BASE = ROUTE_BASES['hackathon-pages']
const SUMMIT_BASE = ROUTE_BASES['summit-pages']

function pathIsUnderBase(restPath: string, base: string): boolean {
  return restPath === base || restPath.startsWith(`${base}/`)
}

/**
 * Which site a URL belongs to, ignoring locale prefix.
 * Hackathon wins if a path somehow sat under both bases.
 */
export function siteSectionFromPathname(pathname: string): SiteSection {
  const path = stripTrailingSlash(pathname)
  const segments = path.split('/').filter(Boolean)

  const restSegments =
    segments[0] && localePrefixes.includes(segments[0])
      ? segments.slice(1)
      : segments
  const restPath =
    restSegments.length === 0 ? '/' : `/${restSegments.join('/')}`

  if (pathIsUnderBase(restPath, HACKATHON_BASE)) return 'hackathon'
  if (pathIsUnderBase(restPath, SUMMIT_BASE)) return 'summit'
  return 'foundation'
}

/**
 * Blocking inline script for the static 404 page. Netlify serves one
 * `404.html` for every miss, so the original path only exists as
 * `location.pathname`. This paints `data-theme` / `data-site` before first
 * paint — keep the path matching aligned with {@link siteSectionFromPathname}.
 */
export function getApply404ThemeScript(): string {
  return `(function(){
  var prefixes = ${JSON.stringify(localePrefixes)};
  var hackathon = ${JSON.stringify(HACKATHON_BASE)};
  var summit = ${JSON.stringify(SUMMIT_BASE)};
  var path = location.pathname.replace(/\\/$/, '') || '/';
  var segments = path.split('/').filter(Boolean);
  if (segments[0] && prefixes.indexOf(segments[0]) !== -1) {
    segments = segments.slice(1);
  }
  var rest = segments.length === 0 ? '/' : '/' + segments.join('/');
  var section = 'foundation';
  if (rest === hackathon || rest.indexOf(hackathon + '/') === 0) section = 'hackathon';
  else if (rest === summit || rest.indexOf(summit + '/') === 0) section = 'summit';
  if (section === 'foundation') return;
  var root = document.documentElement;
  root.setAttribute('data-theme', 'dark');
  root.setAttribute('data-site', section);
  function paintChrome() {
    var header = document.querySelector('[data-component="FoundationHeader"]');
    if (header) header.setAttribute('data-theme', 'dark');
    var home = document.querySelector('[data-404-home]');
    if (home) {
      var href = home.getAttribute('data-home-' + section);
      if (href) home.setAttribute('href', href);
    }
  }
  paintChrome();
  if (!document.querySelector('[data-component="FoundationHeader"]')) {
    var obs = new MutationObserver(function () {
      paintChrome();
      if (document.querySelector('[data-component="FoundationHeader"]')) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();`
}
