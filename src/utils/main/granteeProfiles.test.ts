import { describe, expect, it } from 'vitest'
import type { GranteeProfile } from '@/types/airtable'
import type { Grantee } from './grantee'
import {
  getGranteeProfilePaths,
  getProfileGrants,
  parseGranteeProfiles
} from './granteeProfiles'

function profile(overrides: Partial<GranteeProfile> = {}): GranteeProfile {
  return {
    id: 'recGrantee000001',
    name: 'Gib',
    slug: 'gib',
    granteeType: 'Organisation',
    formerlyKnownAs: null,
    description: null,
    country: 'Kenya',
    website: 'https://gib.example',
    twitter: null,
    linkedIn: null,
    bluesky: null,
    grantIds: ['recUSF6jZiBVoqG01', 'recdUkEFGFR3970nG'],
    grantCount: 2,
    totalCommitted: 50000,
    publishedReportCount: 0,
    thematicTags: ['Payments'],
    logo: null,
    ...overrides
  }
}

// Only the fields getProfileGrants reads matter here.
function grantee(id: string, year: string, startMonth: string): Grantee {
  return { id, year, startMonth } as Grantee
}

describe('parseGranteeProfiles', () => {
  it('accepts profiles as the sync writes them', () => {
    const logo = {
      path: '/img/grantee-profiles/a/b.webp',
      width: 200,
      height: 100,
      alt: ''
    }
    const data = [profile(), profile({ id: 'rec2', slug: 'other', logo })]
    expect(parseGranteeProfiles(data)).toEqual(data)
  })

  it('accepts an empty file, as committed before the first sync', () => {
    expect(parseGranteeProfiles([])).toEqual([])
  })

  it('names the field that does not match', () => {
    const result = parseGranteeProfiles([profile({ slug: 'Not A Slug' })])
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('at 0.slug')
  })

  it('rejects data that is not a list', () => {
    expect(parseGranteeProfiles({})).toBeInstanceOf(Error)
  })

  it('rejects an empty string where the sync writes null', () => {
    expect(parseGranteeProfiles([profile({ country: '' })])).toBeInstanceOf(
      Error
    )
  })
})

describe('getGranteeProfilePaths', () => {
  it('returns one path per profile, keyed by slug', () => {
    const paths = getGranteeProfilePaths([profile()], false)
    expect(paths).toEqual([
      { params: { slug: 'gib' }, props: { profile: profile() } }
    ])
  })

  it('returns no paths while the feature gate is on', () => {
    expect(getGranteeProfilePaths([profile()], true)).toEqual([])
  })

  it('does not read the data while the gate is on', () => {
    expect(getGranteeProfilePaths('not even a list', true)).toEqual([])
  })

  it('returns the parse error when the gate is off', () => {
    expect(getGranteeProfilePaths('not a list', false)).toBeInstanceOf(Error)
  })
})

describe('getProfileGrants', () => {
  it('returns the profile grants that the directory has, newest first', () => {
    const directory = [
      grantee('recUSF6jZiBVoqG01', '2020', '2020-03'),
      grantee('recOtherGrantee01', '2024', '2024-01'),
      grantee('recdUkEFGFR3970nG', '2022', '2022-06')
    ]
    expect(getProfileGrants(profile(), directory).map((g) => g.id)).toEqual([
      'recdUkEFGFR3970nG',
      'recUSF6jZiBVoqG01'
    ])
  })

  it('leaves out a grant that is not published in the directory', () => {
    const directory = [grantee('recdUkEFGFR3970nG', '2022', '2022-06')]
    expect(getProfileGrants(profile(), directory)).toHaveLength(1)
  })

  it('returns an empty list for a grantee with no published grant', () => {
    expect(getProfileGrants(profile(), [])).toEqual([])
  })
})
