import { describe, expect, it } from 'vitest'
import { redirects } from '../redirects'
import redirectConfigJson from './config/redirects.json'
import redirectSchema from '../cms/src/api/redirect/content-types/redirect/schema.json'
import { parseRedirectConfig } from './utils/shared/redirects'
import { REDIRECT_CATEGORIES, type RedirectConfig } from './types/redirects'

const config = parseRedirectConfig(redirectConfigJson) as RedirectConfig
const rules = REDIRECT_CATEGORIES.flatMap((category) => config[category])
const enabledRules = rules.filter((rule) => rule.enabled !== false)
const enabledSources = new Set(enabledRules.map((rule) => rule.source))

function withoutTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/$/, '') : path
}

describe('src/config/redirects.json', () => {
  // Parsing also enforces the path rules Strapi applies on save (literal
  // sources, / or https:// destinations) and unique sources; see
  // src/utils/shared/redirects.test.ts.
  it('parses', () => {
    expect(parseRedirectConfig(redirectConfigJson)).not.toBeInstanceOf(Error)
  })

  it('has no redirect that points at itself', () => {
    const selfRedirects = rules.filter(
      (rule) =>
        withoutTrailingSlash(rule.source) ===
        withoutTrailingSlash(rule.destination)
    )
    expect(selfRedirects).toEqual([])
  })

  // A chain costs visitors an extra round trip and hides the real target from
  // the link validator. Point the first hop straight at the last one. Only
  // enabled rules reach Astro, so only they can chain.
  it('has no chains', () => {
    const chains = enabledRules.filter((rule) =>
      enabledSources.has(withoutTrailingSlash(rule.destination))
    )
    expect(chains).toEqual([])
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
