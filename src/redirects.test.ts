import { describe, expect, it } from 'vitest'
import { redirects } from '../redirects'
import redirectConfigJson from './config/redirects.json'
import redirectSchema from '../cms/src/api/redirect/content-types/redirect/schema.json'
import { parseRedirectConfig } from './utils/shared/redirects'
import { REDIRECT_CATEGORIES, type RedirectConfig } from './types/redirects'

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
