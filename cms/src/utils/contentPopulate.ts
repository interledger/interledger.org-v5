/**
 * Shared populate configurations for dynamic zone `content` fields.
 *
 * Used by page and blog lifecycles to ensure all block types
 * and their nested relations are fully populated when fetching from Strapi.
 *
 * Keep these in sync with the component lists in the content-type schemas:
 * - foundation-page/schema.json
 * - summit-page/schema.json
 * - foundation-blog-post/schema.json
 */

/** Blocks available in grant page dynamic zones. */
const GRANT_BLOCKS = {
  'blocks.paragraph': {},
  'blocks.split-layout': {
    populate: { media: { populate: { image: true } }, cta: true }
  },
  'blocks.blockquote': {},
  'blocks.callout-text': {},
  'blocks.video-embed': {
    populate: { file: true }
  },
  'blocks.image-block': {
    populate: {
      media: { populate: { image: true } },
      tabletImage: true,
      mobileImage: true
    }
  },
  'blocks.cta-strip': {},
  'blocks.carousel': {
    populate: { logos: true }
  },
  'blocks.number-tiles': {
    populate: { tiles: true }
  },
  'blocks.title-card-grid': {
    populate: { titleCards: { populate: { secondaryCta: true } } }
  }
} as const

/** Blocks shared by all content types. */
const FOUNDATION_PAGE_BLOCKS = {
  'blocks.paragraph': {},
  'blocks.profile': {
    populate: {
      profile: { populate: { media: { populate: { image: true } } } }
    }
  },
  'blocks.profile-grid': {
    populate: { profiles: true }
  },
  'blocks.blockquote': {},
  'blocks.callout-text': {},
  'blocks.cta-strip': {},
  'blocks.pdf-embed': {
    populate: { file: true }
  },
  'blocks.video-embed': {
    populate: { file: true }
  }
} as const

const FOUNDATION_BLOG_BLOCKS = {
  'blocks.paragraph': {},
  'blocks.video-embed': {
    populate: { file: true }
  },
  'blocks.image-block': {
    populate: {
      media: { populate: { image: true } },
      tabletImage: true,
      mobileImage: true
    }
  },
  'blocks.code-block': {}
} as const

/** Populate config for profile-page content field (paragraph blocks only). */
export const PROFILE_PAGE_CONTENT_POPULATE = {
  on: {
    'blocks.paragraph': {}
  }
} as const

/** Populate config for report content field (paragraph blocks only). */
export const REPORT_CONTENT_POPULATE = {
  on: {
    'blocks.paragraph': {}
  }
} as const

/** Populate config for hackathon-page content field (paragraph blocks only). */
export const HACKATHON_PAGE_CONTENT_POPULATE = {
  on: {
    'blocks.paragraph': {}
  }
} as const

/** Populate config for foundation-page and summit-page content fields. */
export const FOUNDATION_PAGE_CONTENT_POPULATE = {
  on: { ...FOUNDATION_PAGE_BLOCKS }
} as const

/** Populate config for foundation-blog-post content fields. */
export const BLOG_CONTENT_POPULATE = {
  on: { ...FOUNDATION_BLOG_BLOCKS }
} as const

/** Populate config for grant-page top-level component fields. */
export const GRANT_PAGE_CONTENT_POPULATE = {
  hero: { populate: '*' },
  primaryCta: true,
  content: {
    on: {
      ...GRANT_BLOCKS,
      'blocks.carousel': {
        populate: { logos: true }
      },
      'blocks.profile-grid': {
        populate: { profiles: true }
      }
    }
  },
  faqSection: { populate: { items: true } },
  ctaStrip: true,
  infoCards: { populate: { card1: true, card2: true, card3: true } }
} as const

/** Populate config for grant-overview-page top-level component fields. */
export const GRANT_OVERVIEW_PAGE_CONTENT_POPULATE = {
  hero: { populate: '*' },
  content: {
    on: { ...GRANT_BLOCKS }
  },
  ctaStrip: true
} as const
