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
 * Returns a Strapi `ValidationError` when a `<CapitalLetter...` pattern is
 * found outside fenced code blocks in any blocks.paragraph content field;
 * returns `undefined` otherwise. The Strapi middleware that calls this
 * narrows on the return and translates a returned error into a 400 response.
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

    const stripped = stripFencedCodeBlocks(block.content)
    const match = stripped.match(/<([A-Z][a-zA-Z]*)/)
    if (match) {
      return new errors.ValidationError(
        `Paragraph block contains JSX-like tag <${match[1]}>. ` +
          `Move it to its own top-level block, or wrap it in a code block (\`\`\`) ` +
          `if it's meant to be displayed as text.`
      )
    }
  }

  return undefined
}

/**
 * Validate that every article bio has a non-empty author.
 *
 * Strapi 5 does not enforce `required` on fields nested in (repeatable)
 * components when saving via the content manager (strapi/strapi#10030,
 * #14780), so an authorless bio can otherwise reach the DB and export as
 * `author: null`, which breaks the Astro build (INTORG-794). This middleware
 * check closes that gap. Returns a `ValidationError` for the first offending
 * bio, or `undefined` when all bios are valid or the field is absent.
 */
export function validateArticleBioAuthors(
  articleBio: unknown
): errors.ValidationError | undefined {
  if (!Array.isArray(articleBio)) return undefined

  const hasEmptyAuthor = articleBio.some(
    (bio) => typeof bio?.author !== 'string' || bio.author.trim() === ''
  )
  if (hasEmptyAuthor) {
    return new errors.ValidationError(
      'Each article bio requires an author name. Add a name, or remove the empty bio.'
    )
  }

  return undefined
}
