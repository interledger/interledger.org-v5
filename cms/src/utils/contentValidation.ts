/**
 * Content validation for Strapi lifecycle hooks.
 *
 * Runs in beforeCreate/beforeUpdate to reject invalid content
 * before it reaches the database.
 */

import { errors } from '@strapi/utils'
import { heroFrontmatter } from './mdx'
import type { NavigationData } from './navigationLifecycle'
import type { PageData } from './pageLifecycle'

/**
 * Wrap a caught error as a Strapi `ValidationError`, preserving its message.
 */
export function toValidationError(error: unknown): errors.ValidationError {
  if (error instanceof errors.ValidationError) return error
  return new errors.ValidationError(
    error instanceof Error ? error.message : String(error)
  )
}

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
 * Validate the optional faqSection component on a grant page.
 *
 * When `faqSection` is absent the section is simply not rendered — that is valid.
 * When it is present all scalar fields are required and `items` must have at least 2 entries.
 *
 * Returns a `ValidationError` on failure, `undefined` on success.
 */
export function validateGrantPageFaqSection(
  body: unknown
): errors.ValidationError | undefined {
  const faq = (body as Record<string, unknown>)?.faqSection
  if (!faq || typeof faq !== 'object') return undefined

  const { title, subtitle, description, ctaText, ctaLink, items } =
    faq as Record<string, unknown>

  if (!title || typeof title !== 'string' || (title as string).trim() === '') {
    return new errors.ValidationError('FAQ Section: Title is required')
  }
  if (
    !subtitle ||
    typeof subtitle !== 'string' ||
    (subtitle as string).trim() === ''
  ) {
    return new errors.ValidationError('FAQ Section: Subtitle is required')
  }
  if (
    !description ||
    typeof description !== 'string' ||
    (description as string).trim() === ''
  ) {
    return new errors.ValidationError('FAQ Section: Description is required')
  }
  if (
    !ctaText ||
    typeof ctaText !== 'string' ||
    (ctaText as string).trim() === ''
  ) {
    return new errors.ValidationError('FAQ Section: Button Text is required')
  }
  if (
    !ctaLink ||
    typeof ctaLink !== 'string' ||
    (ctaLink as string).trim() === ''
  ) {
    return new errors.ValidationError('FAQ Section: Button Link is required')
  }
  if (!Array.isArray(items) || items.length < 2) {
    return new errors.ValidationError(
      'FAQ Section: At least 2 FAQ items are required'
    )
  }
  for (const [i, item] of items.entries()) {
    const { question, answer } = item as Record<string, unknown>
    if (
      !question ||
      typeof question !== 'string' ||
      (question as string).trim() === ''
    ) {
      return new errors.ValidationError(
        `FAQ Section: Item ${i + 1} is missing a question`
      )
    }
    if (
      !answer ||
      typeof answer !== 'string' ||
      (answer as string).trim() === ''
    ) {
      return new errors.ValidationError(
        `FAQ Section: Item ${i + 1} is missing an answer`
      )
    }
  }
  return undefined
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
 * Validate the optional infoCards component on a grant page.
 *
 * When `infoCards` is absent the section is simply not rendered — that is
 * valid. When it is present, all three cards and their heading/body fields
 * are required; Strapi's partial update validator skips required-field
 * checks on PUT, so this fills the gap.
 *
 * Returns a `ValidationError` on failure, `undefined` on success.
 */
export function validateGrantInfoCards(
  body: unknown
): errors.ValidationError | undefined {
  const infoCards = (body as Record<string, unknown>)?.infoCards
  if (!infoCards || typeof infoCards !== 'object') return undefined

  for (const key of ['card1', 'card2', 'card3'] as const) {
    const card = (infoCards as Record<string, unknown>)[key] as
      | Record<string, unknown>
      | undefined
    if (!card || typeof card !== 'object') {
      return new errors.ValidationError(`Information Cards: ${key} is required`)
    }
    if (
      !card.heading ||
      typeof card.heading !== 'string' ||
      card.heading.trim() === ''
    ) {
      return new errors.ValidationError(
        `Information Cards: ${key} heading is required`
      )
    }
    if (
      !card.body ||
      typeof card.body !== 'string' ||
      card.body.trim() === ''
    ) {
      return new errors.ValidationError(
        `Information Cards: ${key} body is required`
      )
    }
  }
  return undefined
}

/**
 * Validate the optional `date` component on a report.
 *
 * When `date` is absent, no dates render on the page — that is valid. When it
 * is present, `publishDate` is required; Strapi's partial update validator
 * skips required-field checks on PUT, so this fills the gap. `lastUpdated`
 * has no separate check: it only ever exists alongside a `date` component,
 * whose presence already requires `publishDate`.
 *
 * Returns a `ValidationError` on failure, `undefined` on success.
 */
export function validateReportDate(
  body: unknown
): errors.ValidationError | undefined {
  const date = (body as Record<string, unknown>)?.date
  if (!date || typeof date !== 'object') return undefined

  const { publishDate } = date as Record<string, unknown>
  if (!publishDate || typeof publishDate !== 'string') {
    return new errors.ValidationError('Date: Publish Date is required')
  }
  return undefined
}

/**
 * Validate the Hero component on page-like content types (foundation-page,
 * summit-page). Delegates to `heroFrontmatter`
 *
 * Returns a `ValidationError` on failure, `undefined` when hero is absent or valid.
 */
export function validateHeroFields(
  page: Pick<PageData, 'hero'>
): errors.ValidationError | undefined {
  if (!page.hero) return undefined
  try {
    heroFrontmatter(page.hero)
  } catch (error) {
    return toValidationError(error)
  }
  return undefined
}

/**
 * Validate a blog post's Article Bio and Related Articles components. Both
 * fields are marked `required` in their component schemas, so Strapi
 * enforces them on create; this fills the same partial-update gap as the
 * other validators here.
 *
 * Returns a `ValidationError` on the first missing field found, `undefined` otherwise.
 */
export function validateBlogFields(post: {
  articleBio?: { author: string | null }[]
  relatedArticles?: { slug: string }[]
}): errors.ValidationError | undefined {
  for (const bio of post.articleBio ?? []) {
    if (!bio.author?.trim()) {
      return new errors.ValidationError('Author Bio: Name is required')
    }
  }
  for (const related of post.relatedArticles ?? []) {
    if (!related.slug) {
      return new errors.ValidationError('Related Articles: Slug is required')
    }
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

/**
 * Validate that every Main Menu group/item/sub-group and the CTA button
 * carry a non-empty label.
 *
 * Returns a `ValidationError` on the first missing label found, `undefined` otherwise.
 */
export function validateNavigationLabels(
  data: NavigationData
): errors.ValidationError | undefined {
  for (const [groupIndex, group] of (data.mainMenu ?? []).entries()) {
    if (!group.label?.trim()) {
      return new errors.ValidationError(
        `Main Menu: Item ${groupIndex + 1} is missing a required label`
      )
    }
    for (const [itemIndex, item] of (group.items ?? []).entries()) {
      if (!item.label?.trim()) {
        return new errors.ValidationError(
          `"${group.label}": Item ${itemIndex + 1} is missing a required label`
        )
      }
    }
    for (const [subGroupIndex, subGroup] of (group.subGroups ?? []).entries()) {
      if (!subGroup.label?.trim()) {
        return new errors.ValidationError(
          `"${group.label}": Sub-group ${subGroupIndex + 1} is missing a required label`
        )
      }
      for (const [itemIndex, item] of (subGroup.items ?? []).entries()) {
        if (!item.label?.trim()) {
          return new errors.ValidationError(
            `"${group.label}" / "${subGroup.label}": Item ${itemIndex + 1} is missing a required label`
          )
        }
      }
    }
  }

  if (data.ctaButton && !data.ctaButton.label?.trim()) {
    return new errors.ValidationError('CTA Button: Label is required')
  }

  return undefined
}
