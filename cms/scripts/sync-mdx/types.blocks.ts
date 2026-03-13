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
  showLinks?: boolean
}

/**
 * blocks.ambassadors-grid – ordered grid of ambassador relations.
 *
 * `ambassadors` uses Strapi v5's `connect` syntax. Order of entries
 * must match the input slug order.
 */
export interface AmbassadorsGridBlock extends StrapiBlockBase {
  __component: 'blocks.ambassadors-grid'
  heading?: string
  ambassadors: { connect: Array<{ documentId: string }> }
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

/** blocks.pdf-embed — inline PDF viewer with download fallback. */
export interface PdfEmbedBlock extends StrapiBlockBase {
  __component: 'blocks.pdf-embed'
  source: 'media_library' | 'external_url'
  /** Strapi upload file integer ID — set when source is 'upload'. */
  file?: number
  /** Set when source is 'external'. */
  externalUrl?: string
  label?: string
  analyticsEvent: string
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
  | PdfEmbedBlock
