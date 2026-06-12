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
