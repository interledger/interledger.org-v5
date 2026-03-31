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

/** Blocks shared by all content types. */
const SHARED_BLOCKS = {
  'blocks.paragraph': {},
  'blocks.ambassador': {
    populate: { ambassador: { populate: { photo: true } } }
  },
  'blocks.ambassadors-grid': {
    populate: { ambassadors: true }
  },
  'blocks.blockquote': {},
  'blocks.callout-text': {},
  'blocks.pdf-embed': {
    populate: { file: true }
  },
  'blocks.video-embed': {}
} as const

/** Page-only blocks (not available in blog posts). */
const PAGE_ONLY_BLOCKS = {
  'blocks.cards-grid': {},
  'blocks.card-links-grid': {},
  'blocks.carousel': {},
  'blocks.cta-banner': {}
} as const

/** Populate config for foundation-page and summit-page content fields. */
export const PAGE_CONTENT_POPULATE = {
  on: { ...SHARED_BLOCKS, ...PAGE_ONLY_BLOCKS }
} as const

/** Populate config for foundation-blog-post content fields. */
export const BLOG_CONTENT_POPULATE = {
  on: { ...SHARED_BLOCKS }
} as const
