/**
 * Shared populate configuration for dynamic zone `content` fields.
 *
 * Used by both page and blog lifecycles to ensure all block types
 * and their nested relations are fully populated when fetching from Strapi.
 */
export const CONTENT_BLOCK_POPULATE = {
  on: {
    'blocks.paragraph': {},
    'blocks.callout-text': {},
    'blocks.blockquote': {},
    'blocks.cards-grid': {},
    'blocks.card-links-grid': {},
    'blocks.carousel': {},
    'blocks.cta-banner': {},
    'blocks.ambassador': {
      populate: { ambassador: { populate: { photo: true } } }
    },
    'blocks.ambassadors-grid': {
      populate: { ambassadors: true }
    },
    'blocks.pdf-embed': {
      populate: { file: true }
    },
    'blocks.video-embed': {}
  }
} as const
