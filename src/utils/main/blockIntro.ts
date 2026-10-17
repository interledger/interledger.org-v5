import type { BlockIntro } from '../../types/blockIntro'

/** A block intro with every field trimmed and every empty field dropped. */
export type NormalizedBlockIntro = {
  [Field in keyof BlockIntro]-?: string | null
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
  intro: BlockIntro | null | undefined
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
