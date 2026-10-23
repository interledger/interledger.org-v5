import type { BlockIntroData } from '../../types/blockIntro'

/** A block intro with every field trimmed and every empty field dropped. */
export type NormalizedBlockIntro = {
  [Field in keyof BlockIntroData]-?: string | null
}

// CKEditor stores a Shift+Enter break as a literal <br/>. The Strapi
// preview hands the raw field to this helper, and parseMarkdown escapes the
// tag, so promote it to a paragraph break the way the MDX serializer
// (ckeditorFieldToParsedMarkdown) does. Preview and export then agree.
const BREAK_TAG = /<br\s*\/?>/gi
const PARAGRAPH_BREAK = '\n\n'

function trimmedText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Normalizes the `intro` prop a block receives from MDX or the Strapi
 * preview. Returns `null` when no field has content, so the block renders no
 * intro at all, and its top spacer with it. A non-string field counts as
 * empty rather than reaching the markup.
 */
export function normalizeBlockIntro(
  intro: BlockIntroData | null | undefined
): NormalizedBlockIntro | null {
  if (!intro || typeof intro !== 'object') return null

  const normalized: NormalizedBlockIntro = {
    heading: trimmedText(intro.heading),
    subheading: trimmedText(intro.subheading),
    description: trimmedText(
      typeof intro.description === 'string'
        ? intro.description.replace(BREAK_TAG, PARAGRAPH_BREAK)
        : intro.description
    )
  }
  const hasContent = Object.values(normalized).some((value) => value !== null)
  return hasContent ? normalized : null
}

/**
 * The intro a block renders while its legacy `title`/`heading` prop still
 * exists (until Phase 4 of INTORG-1154): the intro when it has content,
 * otherwise the legacy value as the heading. Content not yet migrated keeps
 * its heading.
 */
export function resolveBlockIntro(
  intro: BlockIntroData | null | undefined,
  legacyHeading: string | null | undefined
): NormalizedBlockIntro | null {
  return (
    normalizeBlockIntro(intro) ??
    normalizeBlockIntro({ heading: legacyHeading })
  )
}

/**
 * The text that names a block for screen readers: its intro heading, or the
 * subheading when there is none. `null` when the intro has neither, so the
 * block falls back to its own `aria-label`.
 */
export function blockIntroLabel(
  intro: NormalizedBlockIntro | null
): string | null {
  return intro?.heading ?? intro?.subheading ?? null
}

/** How a block names its `<section>` for screen readers. */
export interface BlockIntroA11y {
  /** Goes on BlockIntro (`headingId`) and on the section's `aria-labelledby`. */
  headingId: string | undefined
  /** The section's `aria-label`, used only when the intro can't name it. */
  ariaLabel: string | undefined
}

/**
 * Names a block's `<section>`: by its intro heading (or subheading) when the
 * intro has one, otherwise by `fallbackLabel`. The id is random, so two
 * blocks with the same heading on one page never share it.
 */
export function blockIntroA11y(
  intro: NormalizedBlockIntro | null,
  idPrefix: string,
  fallbackLabel?: string
): BlockIntroA11y {
  if (blockIntroLabel(intro)) {
    return {
      headingId: `${idPrefix}-heading-${crypto.randomUUID()}`,
      ariaLabel: undefined
    }
  }
  return { headingId: undefined, ariaLabel: fallbackLabel?.trim() || undefined }
}

/** A markdown `## Heading` line, with optional closing hashes. */
const TRAILING_H2 = /(?:^|\n)##[ \t]+(.+?)[ \t]*#*[ \t]*\s*$/

/**
 * Splits a trailing `## Heading` off markdown that titles the block after
 * it, so the heading can become that block's intro instead of running text.
 * Returns the markdown unchanged and `heading: null` when it doesn't end on
 * an h2.
 */
export function splitTrailingHeading(markdown: string): {
  body: string
  heading: string | null
} {
  const match = TRAILING_H2.exec(markdown)
  if (!match) return { body: markdown, heading: null }
  return {
    body: markdown.slice(0, match.index).trimEnd(),
    heading: match[1].trim()
  }
}
