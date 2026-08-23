/**
 * Grouped names for known external destination domains (ADR-006 "Path
 * grouping algorithm", step 1). This list needs ongoing maintenance as new
 * destinations are added — add one entry per new external target, matching
 * on the registrable domain (subdomains match via `endsWith`).
 */
const EXTERNAL_DOMAIN_GROUPS: Record<string, string> = {
  'ti.to': 'tito',
  'submittable.com': 'submittable', // seen as interledger.submittable.com
  'github.com': 'github',
  'webmonetization.org': 'webmonetization',
  'openpayments.dev': 'openpayments',
  'rafiki.dev': 'rafiki',
  'learn.interledger.org': 'learn_interledger',
  'wallet.interledger-test.dev': 'wallet', // test wallet
  'interledger.app': 'wallet', // prod wallet
  'slack.com': 'slack', // seen as join.slack.com
  'x.com': 'x',
  'linkedin.com': 'linkedin',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'instagram.com': 'instagram',
  'facebook.com': 'facebook'
}

// Mastodon is federated (no shared hostname across instances), except
// Interledger's own instance, which doesn't contain the literal substring
// "mastodon" — so a generic `hostname.includes('mastodon')` heuristic would
// miss it. Explicit entry:
const MASTODON_HOSTNAMES = new Set(['interledger.social'])

export const OTHER_EXTERNAL = 'other_external'

/** Groups a hostname into its known destination name, or `other_external`. */
export function getExternalGroupName(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  if (MASTODON_HOSTNAMES.has(host)) return 'mastodon'

  for (const [domain, group] of Object.entries(EXTERNAL_DOMAIN_GROUPS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return group
  }
  return OTHER_EXTERNAL
}
