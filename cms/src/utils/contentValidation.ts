/**
 * Content validation for Strapi lifecycle hooks.
 *
 * Runs in beforeCreate/beforeUpdate to reject invalid content
 * before it reaches the database.
 */

import { errors } from '@strapi/utils'

/**
 * Strip backtick-delimited code so JSX/HTML tags written as literal code aren't
 * mistaken for bare JSX. Covers inline spans (`…`, ``…``) and fenced
 * (```…```) blocks alike — a fenced block is just a 3-backtick span, so this
 * single pass over balanced backtick runs handles both. The developers blog
 * routinely shows tags like `<wallet-address />` inline, so the merged blog
 * must accept the same (INTORG-793).
 */
function stripInlineCode(text: string): string {
  return text.replace(/(`+)[\s\S]*?\1/g, '')
}

/**
 * Validate the optional primaryCta component on a grant page.
 *
 * When `primaryCta` is absent the CTA is simply not rendered — that is valid.
 * When it is present both `text` and `link` are required; Strapi's partial
 * update validator skips required-field checks on PUT, so this fills the gap.
 *
 * Returns a `ValidationError` on failure, `undefined` on success.
 */
export function validateGrantPagePrimaryCta(
  body: unknown
): errors.ValidationError | undefined {
  const cta = (body as Record<string, unknown>)?.primaryCta
  if (!cta || typeof cta !== 'object') return undefined

  const { text, link } = cta as Record<string, unknown>
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return new errors.ValidationError(
      'Primary Call to Action: Text is required'
    )
  }
  if (!link || typeof link !== 'string' || link.trim() === '') {
    return new errors.ValidationError(
      'Primary Call to Action: Link is required'
    )
  }
  return undefined
}

/**
 * Validate that no Paragraph block contains bare JSX-like tags.
 *
 * Returns a Strapi `ValidationError` when a `<CapitalLetter...` pattern is
 * found outside code (fenced blocks or inline spans) in any blocks.paragraph
 * content field; returns `undefined` otherwise. The Strapi middleware that
 * calls this narrows on the return and translates a returned error into a 400
 * response.
 */
export function validateNoNestedJsx(
  content: unknown
): errors.ValidationError | undefined {
  if (!Array.isArray(content)) return undefined

  for (const block of content) {
    if (
      block?.__component !== 'blocks.paragraph' ||
      typeof block.content !== 'string'
    ) {
      continue
    }

    const stripped = stripInlineCode(block.content)
    const match = stripped.match(/<([A-Z][a-zA-Z]*)/)
    if (match) {
      return new errors.ValidationError(
        `Paragraph block contains JSX-like tag <${match[1]}>. ` +
          `Move it to its own top-level block, or wrap it in code ` +
          `(inline \`backticks\` or a \`\`\` fenced block) if it's meant to be ` +
          `displayed as text.`
      )
    }
  }

  return undefined
}
