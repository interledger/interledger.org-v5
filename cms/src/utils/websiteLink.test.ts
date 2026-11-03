import { readFileSync } from 'fs'
import * as yaml from 'js-yaml'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { SITE_HOSTS } from './relativeLinks'
import { resolveWebsiteLink } from './websiteLink'

// Literal strings throughout, not the module's own constants: a typo in the
// map, or a variable name that drifts from the one the rebuild workflow sets,
// must fail here.
const LOCAL_LINK = {
  url: 'http://localhost:1103/',
  label: 'Local website'
}

describe('resolveWebsiteLink', () => {
  it.each([
    ['local', LOCAL_LINK],
    [
      'staging',
      { url: 'https://staging.interledger.org/', label: 'Staging website' }
    ],
    [
      'playground',
      {
        url: 'https://playground--interledger-org-v5.netlify.app/',
        label: 'Playground website'
      }
    ]
  ])('links the %s admin to its own website', (name, expected) => {
    expect(resolveWebsiteLink({ STRAPI_ADMIN_ENVIRONMENT_NAME: name })).toEqual(
      expected
    )
  })

  it('links to the local website when there is no env at all', () => {
    // The admin passes `undefined` when `process` is not defined.
    expect(resolveWebsiteLink(undefined)).toEqual(LOCAL_LINK)
  })

  it('links to the local website when the name is not set', () => {
    // Every build outside the VMs: `pnpm develop`, a local build, CI.
    expect(resolveWebsiteLink({})).toEqual(LOCAL_LINK)
  })

  it('links to the local website for an unknown name', () => {
    // Matching is case-sensitive, so a mistyped `Local` is unknown too.
    expect(
      resolveWebsiteLink({ STRAPI_ADMIN_ENVIRONMENT_NAME: 'Local' })
    ).toEqual(LOCAL_LINK)
  })
})

// The VM admins are built by this workflow, which passes the deploy branch
// as the environment name. These tests read the real file, so a renamed
// variable or a branch the map does not know fails here instead of sending a
// VM admin to localhost.
const REBUILD_WORKFLOW = path.resolve(
  __dirname,
  '../../../.github/workflows/strapi-rebuild-and-sync.yml'
)

/** Every shell script the rebuild job runs, in order. */
function readRebuildJobScript(): string {
  const workflow = yaml.load(readFileSync(REBUILD_WORKFLOW, 'utf8')) as {
    jobs: Record<string, { steps: { run?: string }[] }>
  }
  return workflow.jobs['rebuild-and-sync'].steps
    .map((step) => step.run ?? '')
    .join('\n')
}

/** The branches the job accepts: the arm of its branch check that does not exit. */
function deployBranches(script: string): string[] {
  const allowed = script.match(
    /case "\$\{DEPLOY_BRANCH:-\}" in\s*\n\s*([^)\n]+)\)/
  )
  if (!allowed) throw new Error('No branch check found in the rebuild workflow')
  return allowed[1].split('|').map((branch) => branch.trim())
}

/** The command that builds the admin: the build right after `cd` into cms. */
function adminBuildCommand(script: string): string {
  const build = script.match(
    /cd "\$DEPLOY_PATH\/cms"\n(?:\s*#[^\n]*\n)*\s*([^\n]*pnpm run build[^\n]*)/
  )
  if (!build) throw new Error('No admin build found in the rebuild workflow')
  return build[1]
}

describe('the rebuild workflow', () => {
  const script = readRebuildJobScript()
  const branches = deployBranches(script)

  it('builds the admin with the deploy branch as its environment name', () => {
    expect(adminBuildCommand(script)).toContain(
      'STRAPI_ADMIN_ENVIRONMENT_NAME="$DEPLOY_BRANCH"'
    )
  })

  // `SITE_HOSTS` keeps editors' links to these sites relative. A site that
  // moves host must move in both places. Also fails a branch that falls back to
  // localhost, which is not a site host.
  it.each(branches)('lists the %s website host in SITE_HOSTS', (branch) => {
    const { url } = resolveWebsiteLink({
      STRAPI_ADMIN_ENVIRONMENT_NAME: branch
    })
    expect(SITE_HOSTS).toContain(new URL(url).host)
  })
})
