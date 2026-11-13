import {
  BLOCK_INTRO_FIELDS,
  type BlockIntroField,
  type BlockIntroInput,
  type SerializedBlockIntro
} from './contentTypes'
import { ckeditorFieldToParsedMarkdown } from './mdx'

// heading and subheading are plain-text string fields, rendered as text, so
// they are only trimmed. description is CKEditor markdown that the site
// renders with parseMarkdown, so a <br/> has to become a paragraph break.
function normalizeField(field: BlockIntroField, value: string): string {
  return field === 'description'
    ? ckeditorFieldToParsedMarkdown(value)
    : value.trim()
}

/**
 * Normalizes a `shared.block-intro` component, or returns `null` when no
 * field has content, so an empty intro writes nothing to MDX.
 */
export function normalizeBlockIntroForMdx(
  intro: BlockIntroInput | null | undefined
): SerializedBlockIntro | null {
  if (!intro) return null

  const normalized: SerializedBlockIntro = {}
  for (const field of BLOCK_INTRO_FIELDS) {
    const value = intro[field]
    if (typeof value !== 'string') continue
    const text = normalizeField(field, value)
    if (text) normalized[field] = text
  }
  return Object.keys(normalized).length > 0 ? normalized : null
}

/**
 * The ` intro={{…}}` JSX attribute for a block's serialized MDX tag, with its
 * leading space, or `''` when the intro is empty. Values are JSON strings, so
 * quotes, backslashes, newlines and braces need no further escaping: MDX
 * parses the expression with acorn, which reads string literals.
 *
 * @example
 * serializeIntroProp({ heading: 'Our grants', subheading: null })
 * // → ' intro={{"heading":"Our grants"}}'
 */
export function serializeIntroProp(
  intro: BlockIntroInput | null | undefined
): string {
  const normalized = normalizeBlockIntroForMdx(intro)
  if (!normalized) return ''

  // normalizeBlockIntroForMdx adds the keys in BLOCK_INTRO_FIELDS order.
  return ` intro={${JSON.stringify(normalized)}}`
}
