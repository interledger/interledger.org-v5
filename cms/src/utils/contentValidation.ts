/**
 * Content validation for Strapi lifecycle hooks.
 *
 * Runs in beforeCreate/beforeUpdate to reject invalid content
 * before it reaches the database.
 */

import { errors } from '@strapi/utils'

/**
 * Strip fenced code blocks so their contents aren't mistaken for JSX.
 */
function stripFencedCodeBlocks(text: string): string {
  return text.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '')
}

/**
 * Validate that no Paragraph block contains bare JSX-like tags.
 *
 * Throws ValidationError if a `<CapitalLetter...` pattern is found outside
 * fenced code blocks in any blocks.paragraph content field. Strapi surfaces
 * ValidationError with the message visible in the admin UI.
 */
export function validateNoNestedJsx(content: unknown): void {
  if (!Array.isArray(content)) return

  for (const block of content) {
    if (
      block?.__component !== 'blocks.paragraph' ||
      typeof block.content !== 'string'
    ) {
      continue
    }

    const stripped = stripFencedCodeBlocks(block.content)
    const match = stripped.match(/<([A-Z][a-zA-Z]*)/)
    if (match) {
      throw new errors.ValidationError(
        `Paragraph block contains JSX-like tag <${match[1]}>. ` +
          `Move it to its own top-level block, or wrap it in a code block (\`\`\`) ` +
          `if it's meant to be displayed as text.`
      )
    }
  }
}
