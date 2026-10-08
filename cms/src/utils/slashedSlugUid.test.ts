import { describe, it, expect, vi } from 'vitest'
import {
  nextFreeSlashedSlug,
  patchUidServiceForSlashedSlugs,
  type UidService
} from '@/utils'

describe('nextFreeSlashedSlug', () => {
  it('returns the slashed slug when nothing holds it', () => {
    expect(nextFreeSlashedSlug('my-title', ['/other/'])).toBe('/my-title/')
  })

  // Stored rows may hold either form while they move to `/slug/`.
  it('counts a stored slug as taken in either form', () => {
    expect(nextFreeSlashedSlug('my-title', ['/my-title/'])).toBe('/my-title-1/')
    expect(nextFreeSlashedSlug('my-title', ['my-title'])).toBe('/my-title-1/')
  })

  it('numbers past every taken suffix', () => {
    expect(
      nextFreeSlashedSlug('my-title', [
        '/my-title/',
        'my-title-1',
        '/my-title-2/'
      ])
    ).toBe('/my-title-3/')
  })

  it('ignores a longer slug that merely starts with the same text', () => {
    expect(nextFreeSlashedSlug('my-title', ['/my-title-extended/'])).toBe(
      '/my-title/'
    )
  })
})

function createService() {
  return {
    findUniqueUID: vi.fn(async () => 'strapi-unique'),
    checkUIDAvailability: vi.fn(async () => true)
  } satisfies UidService
}

describe('patchUidServiceForSlashedSlugs', () => {
  const params = {
    contentTypeUID: 'api::foundation-blog-post.foundation-blog-post',
    field: 'pathSlug',
    value: 'rafiki-beta-release',
    locale: 'en'
  }

  it('makes Generate skip a slug stored as /slug/', async () => {
    const service = createService()
    const findMany = vi.fn(async () => [{ pathSlug: '/rafiki-beta-release/' }])
    patchUidServiceForSlashedSlugs(service, () => ({
      findMany,
      count: vi.fn()
    }))

    await expect(service.findUniqueUID(params)).resolves.toBe(
      '/rafiki-beta-release-1/'
    )
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          $or: [
            { pathSlug: { $startsWith: 'rafiki-beta-release' } },
            { pathSlug: { $startsWith: '/rafiki-beta-release' } }
          ]
        },
        locale: 'en'
      })
    )
  })

  it('reports a slug as taken whichever form is stored', async () => {
    const service = createService()
    const count = vi.fn(async () => 1)
    patchUidServiceForSlashedSlugs(service, () => ({
      findMany: vi.fn(),
      count
    }))

    await expect(service.checkUIDAvailability(params)).resolves.toBe(false)
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          pathSlug: {
            $in: ['rafiki-beta-release', '/rafiki-beta-release/']
          }
        }
      })
    )
  })

  it('leaves other uid fields to Strapi', async () => {
    const service = createService()
    const original = service.findUniqueUID
    const documents = vi.fn()
    patchUidServiceForSlashedSlugs(service, documents)

    const other = { ...params, field: 'handle' }
    await expect(service.findUniqueUID(other)).resolves.toBe('strapi-unique')
    await expect(service.checkUIDAvailability(other)).resolves.toBe(true)
    expect(original).toHaveBeenCalledWith(other)
    expect(documents).not.toHaveBeenCalled()
  })
})
