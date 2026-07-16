/**
 * Block type definitions for MDX ↔ Strapi dynamic zone import.
 *
 * These types represent the Strapi REST API payload shapes produced by
 * the MDX block parser — NOT the Strapi schema types (those live in
 * cms/types/generated/components.d.ts and use Schema.Attribute.*).
 *
 * Each type maps to a Strapi component schema under
 * cms/src/components/blocks/ but describes the JSON body sent to the
 * Strapi REST API during import.
 *
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Discriminator present on every Strapi dynamic-zone block payload. */
export interface StrapiBlockBase {
  __component: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Block Payloads
// ---------------------------------------------------------------------------

/** blocks.paragraph – rich text content block. */
export interface ParagraphBlock extends StrapiBlockBase {
  __component: 'blocks.paragraph'
  content: string
  alignment?: 'left' | 'center' | 'right'
}

/**
 * blocks.profile – single profile-page relation block.
 *
 * The `profile` field uses Strapi v5's `connect` syntax for
 * relations inside dynamic zone components.
 */
export interface ProfileBlock extends StrapiBlockBase {
  __component: 'blocks.profile'
  profile: { connect: Array<{ documentId: string }> }
}

/**
 * blocks.profile-grid – summary grid of profile pages, either
 * category-driven or an ordered set of manually picked relations.
 *
 * `profiles` uses Strapi v5's `connect` syntax. Order of entries
 * must match the input slug order.
 *
 * Either `profiles` (explicit slugs) or `category` (dynamic filter)
 * must be provided.
 */
export interface ProfileGridBlock extends StrapiBlockBase {
  __component: 'blocks.profile-grid'
  heading?: string
  profiles?: { connect: Array<{ documentId: string }> }
  category?: string
}

/** blocks.blockquote – styled quote with optional attribution. */
export interface BlockquoteBlock extends StrapiBlockBase {
  __component: 'blocks.blockquote'
  quote: string
  source?: string
}

/** blocks.callout-text – highlighted text block. */
export interface CalloutTextBlock extends StrapiBlockBase {
  __component: 'blocks.callout-text'
  content: string
}

/**
 * blocks.cta-strip – call-to-action strip with a primary CTA, an optional
 * secondary CTA, and a background colour.
 *
 * `description` comes from the JSX children (markdown); the buttons and
 * `color` come from attributes. The secondary CTA is all-or-nothing: either
 * both `secondaryButtonText` and `secondaryButtonLink` are present, or neither.
 */
export interface CtaStripBlock extends StrapiBlockBase {
  __component: 'blocks.cta-strip'
  heading: string
  description: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
  color: 'purple' | 'green'
}

/** blocks.pdf-embed — inline PDF viewer with download fallback. */
export interface PdfEmbedBlock extends StrapiBlockBase {
  __component: 'blocks.pdf-embed'
  source: 'media_library' | 'external_url'
  /** Strapi upload file integer ID — set when source is 'media_library'. */
  file?: number
  /** Set when source is 'external_url'. */
  externalUrl?: string
  label?: string
}

/**
 * blocks.video-embed — a YouTube/Vimeo URL, a direct video file URL, or an
 * uploaded video file. Mirrors PdfEmbedBlock: internal (`/`-prefixed) URLs
 * resolve to a Strapi upload integer ID (`file`); everything else is stored in
 * `externalUrl`. `source` discriminates the two.
 */
export interface VideoEmbedBlock extends StrapiBlockBase {
  __component: 'blocks.video-embed'
  source: 'media_library' | 'external_url'
  /** Strapi upload file integer ID — set when source is 'media_library'. */
  file?: number
  /** YouTube/Vimeo/direct URL — set when source is 'external_url'. */
  externalUrl?: string
  title: string
}

/**
 * blocks.image-block — standalone image with optional responsive variants.
 *
 * `image`, `tabletImage`, and `mobileImage` are Strapi upload integer IDs
 * (single media), resolved from repo asset paths via ctx.resolveMediaUpload.
 * `needsFullView` and `needsOutline` are required on the schema (default false).
 */
export interface ImageBlockBlock extends StrapiBlockBase {
  __component: 'blocks.image-block'
  image: number
  tabletImage?: number
  mobileImage?: number
  altText?: string
  needsFullView: boolean
  needsOutline: boolean
}

/** blocks.code-block — syntax-highlighted code snippet. */
export interface CodeBlockBlock extends StrapiBlockBase {
  __component: 'blocks.code-block'
  code: string
  language: string
  title?: string
}

/** blocks.split-layout – two-column layout with media on one side and content on the other. */
export interface SplitLayoutBlock extends StrapiBlockBase {
  __component: 'blocks.split-layout'
  layoutType: 'image-text' | 'image-quote' | 'video-text' | 'video-quote'
  imagePosition: 'left' | 'right'
  image?: number | null
  imageAlt?: string
  videoUrl?: string
  content?: string
  quote?: string
  quoteSource?: string
  cta?: {
    text: string
    link: string
    style?: string
    external?: boolean
  }
}

/** blocks.carousel — logo carousel. `logos` are Strapi upload file IDs. */
export interface CarouselBlock extends StrapiBlockBase {
  __component: 'blocks.carousel'
  heading?: string
  accessibilityLabel: string
  logos: number[]
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

/** Any block the parser can produce. */
export type ParsedBlock =
  | ParagraphBlock
  | ProfileBlock
  | ProfileGridBlock
  | BlockquoteBlock
  | CalloutTextBlock
  | CtaStripBlock
  | PdfEmbedBlock
  | VideoEmbedBlock
  | CodeBlockBlock
  | SplitLayoutBlock
  | CarouselBlock
  | ImageBlockBlock
