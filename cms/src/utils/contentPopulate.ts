/**
 * Shared populate configurations for dynamic zone `content` fields.
 *
 * Used by page and blog lifecycles to ensure all block types
 * and their nested relations are fully populated when fetching from Strapi.
 *
 * A dynamic-zone query only returns components listed in its `on` map, so a
 * component a schema allows but this file omits is silently dropped from the
 * MDX export. `contentPopulate.test.ts` walks the schemas and fails on any gap.
 *
 * Listing a component a zone no longer allows is harmless (Strapi ignores it),
 * so the test only checks the schema-to-populate direction.
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
    populate: { logos: { populate: { image: true } } }
  },
  'blocks.number-tiles': {
    populate: { tiles: true }
  },
  'blocks.card-grid': {
    populate: {
      titleCards: { populate: { secondaryCta: true } },
      resourceCards: { populate: { secondaryCta: true } },
      infoCards: true,
      navigationCards: { populate: { secondaryCta: true } }
    }
  },
  'shared.cta-link': {}
} as const

/** Blocks shared by all content types. */
const FOUNDATION_PAGE_BLOCKS = {
  'blocks.paragraph': {},
  'blocks.agenda': {
    populate: { items: true }
  },
  'blocks.split-layout': {
    populate: { media: { populate: { image: true } }, cta: true }
  },
  'blocks.profile': {
    populate: {
      profile: { populate: { media: { populate: { image: true } } } }
    }
  },
  'blocks.profile-grid': {
    populate: { profiles: true }
  },
  'blocks.blockquote': {},
  'blocks.quote': {
    populate: { authorImage: true }
  },
  'blocks.callout-text': {},
  'blocks.cta-strip': {},
  'blocks.pdf-embed': {
    populate: { file: true }
  },
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
  'blocks.number-tiles': {
    populate: { tiles: true }
  },
  'blocks.card-grid': {
    populate: {
      titleCards: { populate: { secondaryCta: true } },
      resourceCards: { populate: { secondaryCta: true } },
      infoCards: true,
      navigationCards: { populate: { secondaryCta: true } }
    }
  },
  'blocks.carousel': {
    populate: { logos: { populate: { image: true } } }
  },
  'blocks.faq': {
    populate: { items: true }
  },
  'blocks.cta-buttons': {
    populate: { buttons: true }
  },
  'blocks.event-card': {
    populate: {
      when: true,
      where: true,
      apply: { populate: { primaryCta: true } }
    }
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
  'blocks.code-block': {},
  'blocks.quote': {
    populate: { authorImage: true }
  }
} as const

/** Populate config for profile-page content field (paragraph blocks only). */
export const PROFILE_PAGE_CONTENT_POPULATE = {
  on: {
    'blocks.paragraph': {}
  }
} as const

/** Populate config for report content field (report-section blocks). */
export const REPORT_CONTENT_POPULATE = {
  on: {
    'blocks.report-section': { populate: { reportText: true } }
  }
} as const

/** Populate config for hackathon-page content field. */
export const HACKATHON_PAGE_CONTENT_POPULATE = {
  on: {
    'blocks.paragraph': {},
    'blocks.card-grid': {
      populate: {
        titleCards: { populate: { secondaryCta: true } },
        resourceCards: { populate: { secondaryCta: true } },
        infoCards: true,
        navigationCards: { populate: { secondaryCta: true } }
      }
    },
    'blocks.number-tiles': {
      populate: { tiles: true }
    },
    'blocks.agenda': {
      populate: { items: true }
    },
    'blocks.split-layout': {
      populate: { media: { populate: { image: true } }, cta: true }
    },
    'blocks.profile-grid': {
      populate: { profiles: true }
    },
    'blocks.cta-strip': {},
    'blocks.carousel': {
      populate: { logos: { populate: { image: true } } }
    },
    'blocks.faq': {
      populate: { items: true }
    },
    'blocks.cta-buttons': {
      populate: { buttons: true }
    },
    'blocks.event-card': {
      populate: {
        when: true,
        where: true,
        apply: { populate: { primaryCta: true } }
      }
    },
    'blocks.quote': {
      populate: { authorImage: true }
    },
    'blocks.hackathon-animation': {},
    'blocks.image-block': {
      populate: {
        media: { populate: { image: true } },
        tabletImage: true,
        mobileImage: true
      }
    }
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
  hero: {
    populate: {
      media: { populate: { image: true } },
      backgroundImageMobile: true,
      hero_call_to_action: true
    }
  },
  primaryCta: true,
  content: {
    on: {
      ...GRANT_BLOCKS,
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
  hero: {
    populate: {
      media: { populate: { image: true } },
      backgroundImageMobile: true,
      hero_call_to_action: true
    }
  },
  content: {
    on: { ...GRANT_BLOCKS }
  },
  ctaStrip: true
} as const

/** Populate config for podcast-page top-level component fields. No dynamic zone — everything is a page-owned repeatable component. */
export const PODCAST_PAGE_CONTENT_POPULATE = {
  hero: {
    populate: {
      media: { populate: { image: true } },
      backgroundImageMobile: true,
      hero_call_to_action: true
    }
  },
  titleCards: {
    populate: { titleCards: { populate: { secondaryCta: true } } }
  },
  podcasts: true,
  ctaStrip: true
} as const
