/**
 * Where the admin's website link points, per environment. Browser-safe; the
 * admin imports it by relative path, not through `@/utils`.
 */

/**
 * Build-time: the rebuild workflow sets it from the deploy branch on the VMs.
 * Every other build (`pnpm develop`, a local build, CI) leaves it unset.
 */
const ENVIRONMENT_NAME_ENV_VAR = 'STRAPI_ADMIN_ENVIRONMENT_NAME'

type SiteEnvironment = 'local' | 'staging' | 'playground'

interface WebsiteLink {
  url: string
  label: string
}

/**
 * Absolute URLs only: Strapi renders a menu link as an external `<a>` only
 * when it starts with `http://` or `https://`.
 */
const WEBSITE_LINKS: Record<SiteEnvironment, WebsiteLink> = {
  local: { url: 'http://localhost:1103/', label: 'Local website' },
  staging: {
    url: 'https://staging.interledger.org/',
    label: 'Staging website'
  },
  playground: {
    url: 'https://playground--interledger-org-v5.netlify.app/',
    label: 'Playground website'
  }
}

function isSiteEnvironment(name: string): name is SiteEnvironment {
  return Object.hasOwn(WEBSITE_LINKS, name)
}

/**
 * The website this admin links to. A missing or unknown name means local:
 * only the VM builds set it, so a VM build that somehow missed it links to
 * localhost and is plainly broken, rather than quietly linking elsewhere.
 *
 * Takes the env bag, as `areAdminNoticesDisabled` does, so the caller owns the
 * guard around `process`.
 */
export function resolveWebsiteLink(
  env: Record<string, string | undefined> | undefined
): WebsiteLink {
  const name = env?.[ENVIRONMENT_NAME_ENV_VAR]
  if (name && isSiteEnvironment(name)) return WEBSITE_LINKS[name]
  return WEBSITE_LINKS.local
}
