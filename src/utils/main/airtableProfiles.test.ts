import { describe, expect, it } from 'vitest'
import type { ParsedGranteeProfile, RawTableRecord } from '@/types/airtable'
import {
  PROFILE_FIELDS,
  findHiddenProfileFields,
  profileFieldIdsToFetch,
  splitThematicTags,
  toGranteeProfile,
  toGranteeProfiles
} from './airtableProfiles'

const CREATED = '2026-10-26T00:00:00.000Z'
const F = PROFILE_FIELDS
const GRANT_ID = 'recUSF6jZiBVoqG01'

// A grantee with the required fields set, as the API returns it (keyed by field ID).
function grantee(
  overrides: Record<string, unknown> = {},
  id = 'recGrantee000001'
): RawTableRecord {
  return {
    id,
    createdTime: CREATED,
    fields: {
      [F.name.id]: 'Gib',
      [F.slug.id]: 'gib',
      [F.granteeType.id]: 'Organisation',
      [F.grants.id]: [GRANT_ID],
      [F.grantCount.id]: 2,
      [F.totalCommitted.id]: 50000,
      [F.publishedReportCount.id]: 1,
      ...overrides
    }
  }
}

function expectParsed(result: unknown): ParsedGranteeProfile {
  expect(result).not.toBeInstanceOf(Error)
  return result as ParsedGranteeProfile
}

function expectError(result: unknown): Error {
  expect(result).toBeInstanceOf(Error)
  return result as Error
}

describe('toGranteeProfile', () => {
  it('maps a grantee with only the required fields, with null for the rest', () => {
    expect(expectParsed(toGranteeProfile(grantee()))).toEqual({
      content: {
        id: 'recGrantee000001',
        name: 'Gib',
        slug: 'gib',
        granteeType: 'Organisation',
        formerlyKnownAs: null,
        description: null,
        country: null,
        website: null,
        twitter: null,
        linkedIn: null,
        bluesky: null,
        grantIds: [GRANT_ID],
        grantCount: 2,
        totalCommitted: 50000,
        publishedReportCount: 1,
        thematicTags: []
      },
      logoSource: null
    })
  })

  it('maps the optional fields when they are set', () => {
    const { content } = expectParsed(
      toGranteeProfile(
        grantee({
          [F.formerlyKnownAs.id]: 'Old Name\n',
          [F.country.id]: 'Kenya',
          [F.website.id]: ' https://gib.example ',
          [F.bluesky.id]: 'https://bsky.app/profile/gib',
          [F.thematicTags.id]: 'Women-led, Payments, Women-led'
        })
      )
    )
    expect(content.formerlyKnownAs).toBe('Old Name')
    expect(content.country).toBe('Kenya')
    expect(content.website).toBe('https://gib.example')
    expect(content.bluesky).toBe('https://bsky.app/profile/gib')
    expect(content.thematicTags).toEqual(['Payments', 'Women-led'])
  })

  it('treats a blank optional text as empty', () => {
    const { content } = expectParsed(
      toGranteeProfile(grantee({ [F.description.id]: '   ' }))
    )
    expect(content.description).toBeNull()
  })

  it('returns the logo as an image source with empty alt text', () => {
    const logo = {
      id: 'attLogo',
      url: 'https://v5.airtableusercontent.com/logo',
      size: 500,
      type: 'image/png'
    }
    const { logoSource } = expectParsed(
      toGranteeProfile(grantee({ [F.logo.id]: [logo] }))
    )
    expect(logoSource).toEqual({
      attachmentId: 'attLogo',
      url: 'https://v5.airtableusercontent.com/logo',
      sizeBytes: 500,
      alt: ''
    })
  })

  it('lists every problem in one error, named by the Airtable field', () => {
    const error = expectError(
      toGranteeProfile(
        grantee({
          [F.slug.id]: 'Café-Gib',
          [F.granteeType.id]: 'Company',
          [F.website.id]: 'gib.example',
          [F.totalCommitted.id]: { error: '#ERROR!' }
        })
      )
    )
    expect(error.message).toContain('Grantee Gib (ID: recGrantee000001)')
    expect(error.message).toContain(
      '"Slug": expected lowercase letters, numbers and single hyphens'
    )
    expect(error.message).toContain(
      '"Grantee Type": expected Organisation or Individual'
    )
    expect(error.message).toContain('"Website": expected an http or https URL')
    expect(error.message).toContain(
      '"Total Committed": expected a number of 0 or more, got {"error":"#ERROR!"}'
    )
  })

  it('fails on a missing name, and names the grantee by its ID', () => {
    const error = expectError(
      toGranteeProfile(grantee({ [F.name.id]: undefined }))
    )
    expect(error.message).toMatch(/^Grantee recGrantee000001:/)
    expect(error.message).toContain('"Name": expected text, got missing')
  })

  it('rejects slugs a URL segment cannot hold', () => {
    for (const slug of ['', 'gib-', '-gib', 'gib--x', 'gib x', 'GIB', 'gíb']) {
      expectError(toGranteeProfile(grantee({ [F.slug.id]: slug })))
    }
  })

  it('rejects a URL that is not http or https', () => {
    for (const url of ['javascript:alert(1)', 'ftp://gib.example', 'gib']) {
      expectError(toGranteeProfile(grantee({ [F.linkedIn.id]: url })))
    }
  })

  it('rejects grant links that are not record IDs', () => {
    expectError(toGranteeProfile(grantee({ [F.grants.id]: ['Gib 2020'] })))
  })

  it('rejects two files in the logo field', () => {
    const logo = { id: 'a', url: 'https://x', size: 1, type: 'image/png' }
    const error = expectError(
      toGranteeProfile(grantee({ [F.logo.id]: [logo, { ...logo, id: 'b' }] }))
    )
    expect(error.message).toContain('"Logo": expected at most 1 file')
  })
})

describe('splitThematicTags', () => {
  it('splits, trims, removes duplicates and sorts', () => {
    expect(splitThematicTags('Women-led, Payments,Women-led , ')).toEqual([
      'Payments',
      'Women-led'
    ])
  })

  it('accepts a list too, in case the rollup changes to an array', () => {
    expect(splitThematicTags(['B', 'A', 'B'])).toEqual(['A', 'B'])
  })

  it('returns an empty list for a missing value', () => {
    expect(splitThematicTags(undefined)).toEqual([])
  })

  it('returns undefined for a value of another shape', () => {
    expect(splitThematicTags(3)).toBeUndefined()
    expect(splitThematicTags([1])).toBeUndefined()
  })
})

describe('toGranteeProfiles', () => {
  it('sorts by slug', () => {
    const result = toGranteeProfiles([
      grantee({ [F.slug.id]: 'zeta' }, 'recZ'),
      grantee({ [F.slug.id]: 'alpha' }, 'recA')
    ])
    expect(
      (result as ParsedGranteeProfile[]).map(({ content }) => content.slug)
    ).toEqual(['alpha', 'zeta'])
  })

  it('fails on two grantees with the same slug', () => {
    const error = expectError(
      toGranteeProfiles([grantee({}, 'recA'), grantee({}, 'recB')])
    )
    expect(error.message).toContain('Slug "gib" is used by recA, recB')
  })

  it('fails on an empty table, because every grantee is public', () => {
    expect(toGranteeProfiles([])).toBeInstanceOf(Error)
  })

  it('lists every bad grantee', () => {
    const error = expectError(
      toGranteeProfiles([
        grantee({ [F.name.id]: undefined }, 'recA'),
        grantee({ [F.slug.id]: 'ok' }, 'recB'),
        grantee({ [F.slug.id]: 'Bad' }, 'recC')
      ])
    )
    expect(error.message).toContain('2 grantee profile problem(s)')
    expect(error.message).toContain('recA')
    expect(error.message).toContain('recC')
  })
})

describe('findHiddenProfileFields', () => {
  it('names each hidden field', () => {
    const visible = profileFieldIdsToFetch().filter((id) => id !== F.logo.id)
    expect(findHiddenProfileFields(visible)).toEqual(['Logo'])
    expect(findHiddenProfileFields(profileFieldIdsToFetch())).toEqual([])
  })
})
