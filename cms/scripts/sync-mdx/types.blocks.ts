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

import {
  CARD_GRID_COLUMNS,
  type CardGridCard,
  type CardGridCardsField,
  type CardGridVariant
} from '../../src/utils/cardGrid'
import { type ReportTextType } from '../../src/utils/reportText'

export {
  CARD_GRID_COLUMNS,
  CARD_GRID_VARIANTS,
  type CardGridCard,
  type CardGridCardsField,
  type CardGridVariant
} from '../../src/utils/cardGrid'

import type { CtaButtonStyle } from '../../src/utils/ctaButtons'

export {
  CTA_BUTTON_STYLES,
  MIN_CTA_BUTTONS,
  MAX_CTA_BUTTONS,
  isCtaButtonStyle,
  hasConflictingCtaFlags,
  validateCtaButtonComposition,
  type CtaButtonStyle
} from '../../src/utils/ctaButtons'

export {
  REPORT_TEXT_TYPES,
  isReportTextType,
  type ReportTextType
} from '../../src/utils/reportText'

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

/**
 * blocks.quote – pull quote with optional author name, image, and link.
 *
 * `quote` comes from the JSX children (markdown). Author fields are optional
 * attributes. `authorImage` is a Strapi media ID after import (or null in
 * dry-run); serializers re-emit a repo path / upload URL.
 */
export interface QuoteBlock extends StrapiBlockBase {
  __component: 'blocks.quote'
  quote: string
  authorName?: string
  /** Strapi upload file integer ID — set when authorImage is provided. */
  authorImage?: number | null
  authorLink?: string
}

/** blocks.callout-text – highlighted text block. */
export interface CalloutTextBlock extends StrapiBlockBase {
  __component: 'blocks.callout-text'
  content: string
}

/**
 * blocks.cta-strip – purple call-to-action strip with one primary CTA.
 *
 * `description` comes from the JSX children (markdown). Heading, description
 * and the secondary CTA are optional; primary CTA text and link are required.
 * The secondary CTA's two fields travel together — both or neither.
 */
export interface CtaStripBlock extends StrapiBlockBase {
  __component: 'blocks.cta-strip'
  heading?: string
  description?: string
  primaryButtonText: string
  primaryButtonLink: string
  primaryButtonExternal?: boolean
  primaryButtonDocument?: boolean
  secondaryButtonText?: string
  secondaryButtonLink?: string
  secondaryButtonExternal?: boolean
  secondaryButtonDocument?: boolean
}

/** blocks.pdf-embed — inline PDF viewer with download fallback. */
export interface PdfEmbedBlock extends StrapiBlockBase {
  __component: 'blocks.pdf-embed'
  source: 'media_library' | 'external_url'
  /**
   * Strapi upload file integer ID — set when source is 'media_library'.
   * `null` only in dry-run mode, when the upload isn't seeded yet.
   */
  file?: number | null
  /** Set when source is 'external_url'. */
  externalUrl?: string
  label?: string
}

/**
 * blocks.video-embed — a YouTube/Vimeo URL, a direct video file URL, or an
 * uploaded video file. `/uploads/`-prefixed URLs are Strapi media uploads and
 * resolve to a Strapi upload integer ID (`file`); everything else (including
 * other `/`-prefixed paths such as `/img/...`) is stored in `externalUrl`.
 * `source` discriminates the two.
 */
export interface VideoEmbedBlock extends StrapiBlockBase {
  __component: 'blocks.video-embed'
  source: 'media_library' | 'external_url'
  /** Strapi upload file integer ID — set when source is 'media_library'. */
  file?: number
  /** YouTube/Vimeo/direct URL — set when source is 'external_url'. */
  externalUrl?: string
  title: string
  /** Optional cover image (Strapi upload id). */
  poster?: number
}

/**
 * blocks.image-block — standalone image with optional responsive variants.
 *
 * `media` is the `shared.localized-media` component (a Strapi upload integer
 * ID plus its per-locale alternative text). `tabletImage`/`mobileImage` are
 * plain Strapi upload integer IDs (single media) sharing `media`'s alt text —
 * they're responsive crops, not separately-translated assets. All are
 * resolved from repo asset paths via ctx.resolveMediaUpload. `needsFullView`
 * and `needsOutline` are required on the schema (default false). Media IDs
 * are `null` only in dry-run mode, when the upload isn't seeded yet.
 */
export interface ImageBlockBlock extends StrapiBlockBase {
  __component: 'blocks.image-block'
  media: {
    image: number | null
    /** null when omitted in MDX; '' when explicitly empty (decorative). */
    alternativeText: string | null
  }
  tabletImage?: number | null
  mobileImage?: number | null
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
  /** Content : media column ratio. Defaults to 2:1 when omitted in MDX. */
  displayRatio?: '1:1' | '1:2' | '2:1'
  media?: {
    image: number | null
    /** null when omitted in MDX; '' when explicitly empty (decorative). */
    alternativeText: string | null
  }
  videoUrl?: string
  content?: string
  quote?: string
  quoteSource?: string
  cta?: {
    text: string
    link: string
    style?: string
    external?: boolean
    document?: boolean
  }
}

/**
 * blocks.carousel — logo carousel.
 * Each logo is a blocks.carousel-logo entry: media ID + optional alt text.
 */
export interface CarouselBlock extends StrapiBlockBase {
  __component: 'blocks.carousel'
  heading?: string
  accessibilityLabel: string
  logos: Array<{ image: number; alternativeText: string | null }>
}

/**
 * blocks.number-tiles — optional title, then a row of stat tiles (number +
 * optional currency prefix and suffix + description). `number` is plain text
 * (not numeric) so editors can type commas manually, e.g. "1,000". At least
 * 2 tiles are required.
 */
export interface NumberTilesBlock extends StrapiBlockBase {
  __component: 'blocks.number-tiles'
  title?: string
  tiles: {
    number: string
    prefix?: string
    suffix?: string
    description: string
  }[]
}

/** blocks.agenda — an optional heading followed by at least two scheduled items. */
export interface AgendaBlock extends StrapiBlockBase {
  __component: 'blocks.agenda'
  heading?: string
  items: {
    time: string
    activity: string
    additionalInfo?: string
  }[]
}

/** shared.cta-link — standalone call-to-action link, usable directly in a dynamic zone. */
export interface CtaLinkBlock extends StrapiBlockBase {
  __component: 'shared.cta-link'
  text: string
  link: string
  style?: 'primary' | 'secondary'
  external?: boolean
  document?: boolean
}

/** shared.cta-button — one entry in blocks.cta-buttons' repeatable `buttons` field. No `__component`; it's a nested component, not a dynamic-zone block. */
export interface CtaButton {
  text: string
  link: string
  style: CtaButtonStyle
  external?: boolean
  document?: boolean
}

/** blocks.cta-buttons — one CTA button, or two side by side. */
export interface CtaButtonsBlock extends StrapiBlockBase {
  __component: 'blocks.cta-buttons'
  buttons: CtaButton[]
}

/** shared.cta-button — one entry in blocks.cta-buttons' repeatable `buttons` field. No `__component`; it's a nested component, not a dynamic-zone block. */
export interface CtaButton {
  text: string
  link: string
  style: CtaButtonStyle
  external?: boolean
  document?: boolean
}

/** blocks.cta-buttons — one CTA button, or two side by side. */
export interface CtaButtonsBlock extends StrapiBlockBase {
  __component: 'blocks.cta-buttons'
  buttons: CtaButton[]
}

/** blocks.card-grid — unified card grid with variant-specific card fields. */
export type CardGridBlock = StrapiBlockBase & {
  __component: 'blocks.card-grid'
  ariaLabel: string
  title?: string
  variant: CardGridVariant
  columns: (typeof CARD_GRID_COLUMNS)[number]
} & Partial<Record<CardGridCardsField, CardGridCard[]>>

/** blocks.faq-item — entry in faq's repeatable `items` field. No `__component`; it's a nested component, not a dynamic-zone block. */
export interface FaqItem {
  question: string
  /** Rich text (CKEditor `basicMarkdownPreset`), stored as markdown. */
  answer: string
}

/** blocks.faq — accordion of question/answer pairs under an optional heading. */
export interface FaqBlock extends StrapiBlockBase {
  __component: 'blocks.faq'
  heading?: string
  items: FaqItem[]
}

/**
 * blocks.report-text — entry in report-section's repeatable `reportText`
 * field. No `__component`; it's a nested component, not a dynamic-zone
 * block. `textType` picks the active field: `Paragraph` → `textContent`,
 * `Disclaimer` → `textDisclaimer`, `Button` → `buttonCta`. `textContent`/
 * `textDisclaimer` are CKEditor rich text, stored as markdown; `buttonCta`
 * is a nested `shared.cta-button` component.
 */
export interface ReportTextItem {
  textType: ReportTextType
  textContent?: string
  textDisclaimer?: string
  buttonCta?: CtaButton
}

/** blocks.report-section — a heading followed by a repeatable list of typed content blocks. */
export interface ReportSectionBlock extends StrapiBlockBase {
  __component: 'blocks.report-section'
  heading: string
  reportText: ReportTextItem[]
}

/** Nested column on blocks.event-card — when an event takes place. */
export interface EventCardWhen {
  title: string
  text?: string
  date?: string
  time?: string
}

/** Nested column on blocks.event-card — where an event takes place. */
export interface EventCardWhere {
  title: string
  text?: string
  location?: string
}

/** Nested column on blocks.event-card — apply / register CTA. */
export interface EventCardApply {
  title?: string
  text?: string
  primaryCta: {
    text: string
    link: string
    external?: boolean
    document?: boolean
  }
}

/**
 * blocks.event-card — full-width when/where/(optional)apply columns.
 * Editors use one at a time; there is no multi-card grid.
 */
export interface EventCardBlock extends StrapiBlockBase {
  __component: 'blocks.event-card'
  title?: string
  when: EventCardWhen
  where: EventCardWhere
  apply?: EventCardApply
}

/**
 * blocks.hackathon-animation — decorative scroll-driven chevron animation.
 * No fields; the tag's presence is the only signal.
 */
export interface HackathonAnimationBlock extends StrapiBlockBase {
  __component: 'blocks.hackathon-animation'
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
  | QuoteBlock
  | CalloutTextBlock
  | CtaStripBlock
  | PdfEmbedBlock
  | VideoEmbedBlock
  | CodeBlockBlock
  | SplitLayoutBlock
  | CarouselBlock
  | ImageBlockBlock
  | NumberTilesBlock
  | CardGridBlock
  | AgendaBlock
  | FaqBlock
  | ReportSectionBlock
  | EventCardBlock
  | CtaLinkBlock
  | CtaButtonsBlock
  | HackathonAnimationBlock
