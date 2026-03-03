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
 * The `ambassador` field holds a Strapi relation connect payload
 * (documentId resolved from slug at parse time).
 */
export interface AmbassadorBlock extends StrapiBlockBase {
  __component: 'blocks.ambassador'
  ambassador: { documentId: string }
  showLinks?: boolean
}

/**
 * blocks.ambassadors-grid – ordered grid of ambassador relations.
 *
 * `ambassadors` is an array of relation connect payloads whose order
 * must match the input slug order.
 */
export interface AmbassadorsGridBlock extends StrapiBlockBase {
  __component: 'blocks.ambassadors-grid'
  heading?: string
  ambassadors: Array<{ documentId: string }>
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
