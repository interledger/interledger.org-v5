import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildContentTypes, type ContentTypes } from './config'
import type { StrapiClient } from './strapiClient'
import { createMdxFile } from './test-utils'

const LOGO_URL = '/img/partner-logos/covenant.avif'
const LOGO_UPLOAD_ID = 42

/**
 * LogoCarousel keeps each logo's name on the upload's `alternativeText`, so a
 * content type that allows `blocks.carousel` has to hand the parser an
 * `updateMediaAlt` callback. Content types are the only place that wiring
 * happens, and a missing callback fails silently (the handler's call is
 * optional), so assert it per content type.
 */
const CAROUSEL_PAGE_TYPES: (keyof ContentTypes)[] = [
  'foundation-pages',
  'summit-pages',
  'hackathon-pages'
]

function stubStrapi() {
  return {
    findUploadByUrl: vi.fn().mockResolvedValue(LOGO_UPLOAD_ID),
    findUploadByName: vi.fn().mockResolvedValue(null),
    updateUploadAlt: vi.fn().mockResolvedValue(undefined)
  } as unknown as StrapiClient & { updateUploadAlt: ReturnType<typeof vi.fn> }
}

function carouselMdx(pathSlug: string) {
  return createMdxFile({
    pathSlug,
    frontmatter: {
      title: 'Demo',
      pathSlug,
      description: 'Demo page'
    },
    content: `<LogoCarousel accessibilityLabel="Partner logos" logos={[{ name: 'Covenant', src: '${LOGO_URL}' }]} />`
  })
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('buildContentTypes carousel alt text wiring', () => {
  it.each(CAROUSEL_PAGE_TYPES)(
    'stores logo names as upload alt text for %s',
    async (contentType) => {
      const strapi = stubStrapi()
      const contentTypes = buildContentTypes(
        '/nonexistent-project-root',
        'http://localhost:1337',
        'token'
      )

      const payload = await contentTypes[contentType].buildPayload(
        carouselMdx('demo'),
        strapi,
        null,
        false
      )

      expect(payload).not.toBeInstanceOf(Error)
      expect((payload as Record<string, unknown>).content).toEqual([
        {
          __component: 'blocks.carousel',
          accessibilityLabel: 'Partner logos',
          logos: [LOGO_UPLOAD_ID]
        }
      ])
      expect(strapi.updateUploadAlt).toHaveBeenCalledWith(
        LOGO_UPLOAD_ID,
        'Covenant'
      )
    }
  )

  it('patches a shared logo upload once across the three page types', async () => {
    const strapi = stubStrapi()
    const contentTypes = buildContentTypes(
      '/nonexistent-project-root',
      'http://localhost:1337',
      'token'
    )

    for (const contentType of CAROUSEL_PAGE_TYPES) {
      await contentTypes[contentType].buildPayload(
        carouselMdx(`demo-${contentType}`),
        strapi,
        null,
        false
      )
    }

    expect(strapi.updateUploadAlt).toHaveBeenCalledTimes(1)
  })
})
