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
 * blocks.ambassador – single ambassador relation block.
 *
 * The `ambassador` field uses Strapi v5's `connect` syntax for
 * relations inside dynamic zone components.
 */
export interface AmbassadorBlock extends StrapiBlockBase {
  __component: 'blocks.ambassador'
  ambassador: { connect: Array<{ documentId: string }> }
}

/**
 * blocks.ambassadors-grid – ordered grid of ambassador relations.
 *
 * `ambassadors` uses Strapi v5's `connect` syntax. Order of entries
 * must match the input slug order.
 *
 * Either `ambassadors` (explicit slugs) or `category` (dynamic filter)
 * must be provided;
 */
export interface AmbassadorsGridBlock extends StrapiBlockBase {
  __component: 'blocks.ambassadors-grid'
  heading?: string
  ambassadors?: { connect: Array<{ documentId: string }> }
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

/** blocks.video-embed — embedded YouTube or Vimeo video. */
export interface VideoEmbedBlock extends StrapiBlockBase {
  __component: 'blocks.video-embed'
  url: string
  title: string
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

/** Any block the parser can produce. */
export type ParsedBlock =
  | ParagraphBlock
  | AmbassadorBlock
  | AmbassadorsGridBlock
  | BlockquoteBlock
  | CalloutTextBlock
  | CtaStripBlock
  | PdfEmbedBlock
  | VideoEmbedBlock
