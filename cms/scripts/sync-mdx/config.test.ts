import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildContentTypes, type ContentTypes } from './config'
import type { StrapiClient } from './strapiClient'
import { createMdxFile } from './test-utils'

const LOGO_URL = '/img/partner-logos/covenant.avif'
const LOGO_UPLOAD_ID = 42

/**
 * LogoCarousel stores each logo as a carousel-logo component (image id + alt).
 * Assert the payload shape for page types that allow blocks.carousel.
 */
const CAROUSEL_PAGE_TYPES: (keyof ContentTypes)[] = [
  'foundation-pages',
  'summit-pages'
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

describe('buildContentTypes carousel logo payload', () => {
  it.each(CAROUSEL_PAGE_TYPES)(
    'stores logos as image + alternativeText components for %s',
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
          logos: [{ image: LOGO_UPLOAD_ID, alternativeText: 'Covenant' }]
        }
      ])
      expect(strapi.updateUploadAlt).not.toHaveBeenCalled()
    }
  )

  it('does not patch Media Library alt when building carousels across page types', async () => {
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

    expect(strapi.updateUploadAlt).not.toHaveBeenCalled()
  })
})
