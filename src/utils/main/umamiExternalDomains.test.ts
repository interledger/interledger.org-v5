import { describe, expect, it } from 'vitest'
import { getExternalGroupName, OTHER_EXTERNAL } from './umamiExternalDomains'

describe('getExternalGroupName', () => {
  it('groups known exact-match hostnames', () => {
    expect(getExternalGroupName('ti.to')).toBe('tito')
    expect(getExternalGroupName('github.com')).toBe('github')
    expect(getExternalGroupName('webmonetization.org')).toBe('webmonetization')
    expect(getExternalGroupName('openpayments.dev')).toBe('openpayments')
    expect(getExternalGroupName('rafiki.dev')).toBe('rafiki')
    expect(getExternalGroupName('learn.interledger.org')).toBe(
      'learn_interledger'
    )
    expect(getExternalGroupName('community.interledger.org')).toBe(
      'community_interledger'
    )
    expect(getExternalGroupName('slack.com')).toBe('slack')
    expect(getExternalGroupName('x.com')).toBe('x')
    expect(getExternalGroupName('linkedin.com')).toBe('linkedin')
    expect(getExternalGroupName('youtube.com')).toBe('youtube')
    expect(getExternalGroupName('youtu.be')).toBe('youtube')
    expect(getExternalGroupName('instagram.com')).toBe('instagram')
    expect(getExternalGroupName('facebook.com')).toBe('facebook')
  })

  it('groups both the test and prod wallet hosts under one name', () => {
    expect(getExternalGroupName('wallet.interledger-test.dev')).toBe('wallet')
    expect(getExternalGroupName('interledger.app')).toBe('wallet')
  })

  it('groups a subdomain of a known domain via endsWith', () => {
    expect(getExternalGroupName('interledger.submittable.com')).toBe(
      'submittable'
    )
    expect(getExternalGroupName('join.slack.com')).toBe('slack')
  })

  it('strips a leading www. before matching', () => {
    expect(getExternalGroupName('www.github.com')).toBe('github')
  })

  it('matches the Interledger Mastodon instance by explicit hostname', () => {
    expect(getExternalGroupName('interledger.social')).toBe('mastodon')
  })

  it('falls back to other_external for unknown domains', () => {
    expect(getExternalGroupName('example.com')).toBe(OTHER_EXTERNAL)
  })

  it('is case-insensitive', () => {
    expect(getExternalGroupName('GitHub.com')).toBe('github')
  })
})
