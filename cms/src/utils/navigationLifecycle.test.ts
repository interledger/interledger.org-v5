import { describe, expect, it, vi } from 'vitest'
import {
  sanitizeMenuItem,
  sanitizeMenuGroup,
  sanitizeMenuSubGroup,
  sanitizeNavigation,
  getLocaleOutputPath,
  type MenuItem
} from './navigationLifecycle'

vi.mock('./gitSync', () => ({
  getTargetRepoRoot: () => '/repo',
  gitCommitAndPush: vi.fn()
}))

vi.mock('./pageLifecycle', () => ({
  shouldSkipMdxExport: () => false
}))

const testConfig = {
  contentTypeUid: 'api::foundation-navigation.foundation-navigation' as const,
  outputPath: 'src/config/foundation-navigation.json',
  populate: {
    mainMenu: {
      populate: {
        items: true as const,
        subGroups: { populate: { items: true as const } }
      }
    },
    ctaButton: true as const
  }
}

describe('sanitizeMenuItem', () => {
  it('returns null for null input', () => {
    expect(sanitizeMenuItem(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(sanitizeMenuItem(undefined)).toBeNull()
  })

  it('keeps label and href', () => {
    expect(sanitizeMenuItem({ label: 'About', href: '/about' })).toEqual({
      label: 'About',
      href: '/about'
    })
  })

  it('omits href when null', () => {
    expect(sanitizeMenuItem({ label: 'About', href: null })).toEqual({
      label: 'About'
    })
  })

  it('omits href when empty string', () => {
    expect(sanitizeMenuItem({ label: 'About', href: '' })).toEqual({
      label: 'About'
    })
  })

  it('includes openInNewTab only when true', () => {
    expect(
      sanitizeMenuItem({ label: 'Ext', href: '/ext', openInNewTab: true })
    ).toEqual({ label: 'Ext', href: '/ext', openInNewTab: true })
  })

  it('omits openInNewTab when false', () => {
    expect(
      sanitizeMenuItem({ label: 'Ext', href: '/ext', openInNewTab: false })
    ).toEqual({ label: 'Ext', href: '/ext' })
  })

  it('omits openInNewTab when null', () => {
    expect(
      sanitizeMenuItem({ label: 'Ext', href: '/ext', openInNewTab: null })
    ).toEqual({ label: 'Ext', href: '/ext' })
  })
})

describe('sanitizeMenuGroup', () => {
  it('returns group with label only when no items or href', () => {
    expect(sanitizeMenuGroup({ label: 'Group' })).toEqual({ label: 'Group' })
  })

  it('includes href when present', () => {
    expect(sanitizeMenuGroup({ label: 'Group', href: '/group' })).toEqual({
      label: 'Group',
      href: '/group'
    })
  })

  it('omits href when null', () => {
    expect(sanitizeMenuGroup({ label: 'Group', href: null })).toEqual({
      label: 'Group'
    })
  })

  it('sanitizes child items', () => {
    const group = {
      label: 'Nav',
      items: [
        { label: 'A', href: '/a' },
        { label: 'B', href: null, openInNewTab: null }
      ]
    }
    expect(sanitizeMenuGroup(group)).toEqual({
      label: 'Nav',
      items: [{ label: 'A', href: '/a' }, { label: 'B' }]
    })
  })

  it('filters out null items', () => {
    const group = {
      label: 'Nav',
      items: [null, { label: 'A', href: '/a' }, undefined] as (
        | MenuItem
        | null
        | undefined
      )[]
    }
    expect(sanitizeMenuGroup(group)).toEqual({
      label: 'Nav',
      items: [{ label: 'A', href: '/a' }]
    })
  })

  it('omits items key when all items are null', () => {
    const group = { label: 'Nav', items: [null, null] as (MenuItem | null)[] }
    expect(sanitizeMenuGroup(group)).toEqual({ label: 'Nav' })
  })

  it('omits items key when items array is empty', () => {
    expect(sanitizeMenuGroup({ label: 'Nav', items: [] })).toEqual({
      label: 'Nav'
    })
  })

  it('sanitizes subGroups and their items', () => {
    const group = {
      label: 'Tech',
      subGroups: [
        {
          label: 'Standards',
          items: [
            { label: 'ILP', href: 'interledger' },
            { label: 'Open Payments', href: '/open-payments' }
          ]
        }
      ]
    }
    expect(sanitizeMenuGroup(group)).toEqual({
      label: 'Tech',
      subGroups: [
        {
          label: 'Standards',
          items: [
            { label: 'ILP', href: '/interledger' },
            { label: 'Open Payments', href: '/open-payments' }
          ]
        }
      ]
    })
  })

  it('omits subGroups key when subGroups array is empty', () => {
    expect(sanitizeMenuGroup({ label: 'Nav', subGroups: [] })).toEqual({
      label: 'Nav'
    })
  })

  it('keeps both items and subGroups when both are present', () => {
    const group = {
      label: 'Tech',
      items: [{ label: 'A', href: '/a' }],
      subGroups: [{ label: 'Sub', items: [{ label: 'B', href: '/b' }] }]
    }
    expect(sanitizeMenuGroup(group)).toEqual({
      label: 'Tech',
      items: [{ label: 'A', href: '/a' }],
      subGroups: [{ label: 'Sub', items: [{ label: 'B', href: '/b' }] }]
    })
  })
})

describe('sanitizeMenuSubGroup', () => {
  it('returns label only when no items', () => {
    expect(sanitizeMenuSubGroup({ label: 'Standards' })).toEqual({
      label: 'Standards'
    })
  })

  it('sanitizes child items', () => {
    const subGroup = {
      label: 'Standards',
      items: [
        { label: 'A', href: '/a' },
        { label: 'B', href: null, openInNewTab: null }
      ]
    }
    expect(sanitizeMenuSubGroup(subGroup)).toEqual({
      label: 'Standards',
      items: [{ label: 'A', href: '/a' }, { label: 'B' }]
    })
  })

  it('omits items key when items array is empty', () => {
    expect(sanitizeMenuSubGroup({ label: 'Standards', items: [] })).toEqual({
      label: 'Standards'
    })
  })
})

describe('sanitizeNavigation', () => {
  it('returns empty mainMenu when no data', () => {
    expect(sanitizeNavigation({})).toEqual({ mainMenu: [] })
  })

  it('sanitizes mainMenu groups', () => {
    const data = {
      mainMenu: [
        { label: 'Foundation', items: [{ label: 'About', href: '/about' }] }
      ]
    }
    expect(sanitizeNavigation(data)).toEqual({
      mainMenu: [
        { label: 'Foundation', items: [{ label: 'About', href: '/about' }] }
      ]
    })
  })

  it('includes ctaButton when present', () => {
    const data = {
      mainMenu: [],
      ctaButton: { label: 'Summit', href: '/summit' }
    }
    expect(sanitizeNavigation(data)).toEqual({
      mainMenu: [],
      ctaButton: { label: 'Summit', href: '/summit' }
    })
  })

  it('omits ctaButton when null', () => {
    const data = { mainMenu: [], ctaButton: null }
    expect(sanitizeNavigation(data)).toEqual({ mainMenu: [] })
  })

  it('strips Strapi metadata fields (id, documentId, publishedAt)', () => {
    const data = {
      id: 1,
      documentId: 'abc',
      publishedAt: '2026-01-01',
      mainMenu: [{ label: 'Nav' }]
    }
    const result = sanitizeNavigation(data)
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('documentId')
    expect(result).not.toHaveProperty('publishedAt')
  })
})

describe('getLocaleOutputPath', () => {
  it('uses outputPath as-is for default locale (en)', () => {
    const result = getLocaleOutputPath(testConfig, 'en')
    expect(result).toBe('/repo/src/config/foundation-navigation.json')
  })

  it('derives es path from outputPath', () => {
    const result = getLocaleOutputPath(testConfig, 'es')
    expect(result).toBe('/repo/src/config/foundation-navigation.es.json')
  })

  it('works with summit navigation config', () => {
    const summitConfig = {
      contentTypeUid: 'api::summit-navigation.summit-navigation' as const,
      outputPath: 'src/config/summit-navigation.json',
      populate: {
        mainMenu: {
          populate: {
            items: true as const,
            subGroups: { populate: { items: true as const } }
          }
        },
        ctaButton: true as const
      }
    }
    expect(getLocaleOutputPath(summitConfig, 'es')).toBe(
      '/repo/src/config/summit-navigation.es.json'
    )
  })
})
