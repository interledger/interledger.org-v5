/**
 * Content validation for Strapi lifecycle hooks.
 *
 * Runs in beforeCreate/beforeUpdate to reject invalid content
 * before it reaches the database.
 */

import { errors } from '@strapi/utils'
import type { NavigationData } from './navigationLifecycle'
import type { PageData } from './pageLifecycle'

export interface FieldError {
  path: Array<string | number>
  message: string
}

/**
 * Thrown by block serializers when one or more fields fail validation.
 * Lets `toValidationError` surface every failure in one `details.errors`
 * array instead of one error per save attempt.
 */
export class SerializerFieldError extends Error {
  fieldErrors: FieldError[]

  constructor(fieldErrors: FieldError[]) {
    super(fieldErrors[0]?.message ?? 'Serializer validation failed')
    this.name = 'SerializerFieldError'
    this.fieldErrors = fieldErrors
  }
}

/**
 * Wrap a caught error as a Strapi `ValidationError`, preserving its message
 * and, for a `SerializerFieldError`, every failing field's path — so the
 * admin UI can highlight all of them.
 */
export function toValidationError(error: unknown): errors.ValidationError {
  if (error instanceof errors.ValidationError) return error
  if (error instanceof SerializerFieldError) {
    return new errors.ValidationError(error.message, {
      errors: error.fieldErrors.map(({ path, message }) => ({
        path: path.map(String),
        message,
        name: 'ValidationError'
      }))
    })
  }
  return new errors.ValidationError(
    error instanceof Error ? error.message : String(error)
  )
}

/**
 * Combine every field-level failure found by a single validator into one
 * `ValidationError`, shaped like Strapi's own Yup validation errors
 * (`details.errors: [{ path, message }]`). The admin's
 * `_unstableFormatValidationErrors` iterates that array and highlights every
 * offending field — so collecting all failures here (rather than stopping at
 * the first) lets an editor fix everything in one pass instead of one save
 * attempt per mistake.
 *
 * Returns `undefined` when `fieldErrors` is empty (nothing to report).
 */
function combineFieldErrors(
  fieldErrors: FieldError[]
): errors.ValidationError | undefined {
  if (fieldErrors.length === 0) return undefined
  return new errors.ValidationError(fieldErrors[0]!.message, {
    errors: fieldErrors.map(({ path, message }) => ({
      path: path.map(String),
      message,
      name: 'ValidationError'
    }))
  })
}

/**
 * Merge the `details.errors` of multiple validators (e.g. one content type's
 * primaryCta check and its FAQ section check) into a single `ValidationError`,
 * so a save reports every failing field across every validator in one
 * response instead of only the first validator that found something.
 */
export function mergeValidationErrors(
  ...validationErrors: Array<errors.ValidationError | undefined>
): errors.ValidationError | undefined {
  const present = validationErrors.filter(
    (err): err is errors.ValidationError => err != null
  )
  if (present.length === 0) return undefined
  if (present.length === 1) return present[0]
  const allFieldErrors = present.flatMap(
    (err) => (err.details as { errors?: unknown[] } | undefined)?.errors ?? []
  )
  return new errors.ValidationError(present[0]!.message, {
    errors: allFieldErrors
  })
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
 * Returns a `ValidationError` combining every failing field, `undefined` on success.
 */
export function validateGrantPageFaqSection(
  body: unknown
): errors.ValidationError | undefined {
  const faq = (body as Record<string, unknown>)?.faqSection
  if (!faq || typeof faq !== 'object') return undefined

  const { title, subtitle, description, ctaText, ctaLink, items } =
    faq as Record<string, unknown>
  const fieldErrors: FieldError[] = []

  if (!title || typeof title !== 'string' || (title as string).trim() === '') {
    fieldErrors.push({
      message: 'FAQ Section: Title is required',
      path: ['faqSection', 'title']
    })
  }
  if (
    !subtitle ||
    typeof subtitle !== 'string' ||
    (subtitle as string).trim() === ''
  ) {
    fieldErrors.push({
      message: 'FAQ Section: Subtitle is required',
      path: ['faqSection', 'subtitle']
    })
  }
  if (
    !description ||
    typeof description !== 'string' ||
    (description as string).trim() === ''
  ) {
    fieldErrors.push({
      message: 'FAQ Section: Description is required',
      path: ['faqSection', 'description']
    })
  }
  if (
    !ctaText ||
    typeof ctaText !== 'string' ||
    (ctaText as string).trim() === ''
  ) {
    fieldErrors.push({
      message: 'FAQ Section: Button Text is required',
      path: ['faqSection', 'ctaText']
    })
  }
  if (
    !ctaLink ||
    typeof ctaLink !== 'string' ||
    (ctaLink as string).trim() === ''
  ) {
    fieldErrors.push({
      message: 'FAQ Section: Button Link is required',
      path: ['faqSection', 'ctaLink']
    })
  }
  if (!Array.isArray(items) || items.length < 2) {
    fieldErrors.push({
      message: 'FAQ Section: At least 2 FAQ items are required',
      path: ['faqSection', 'items']
    })
  }
  for (const [i, item] of (Array.isArray(items) ? items : []).entries()) {
    const { question, answer } = item as Record<string, unknown>
    if (
      !question ||
      typeof question !== 'string' ||
      (question as string).trim() === ''
    ) {
      fieldErrors.push({
        message: `FAQ Section: Item ${i + 1} is missing a question`,
        path: ['faqSection', 'items', i, 'question']
      })
    }
    if (
      !answer ||
      typeof answer !== 'string' ||
      (answer as string).trim() === ''
    ) {
      fieldErrors.push({
        message: `FAQ Section: Item ${i + 1} is missing an answer`,
        path: ['faqSection', 'items', i, 'answer']
      })
    }
  }
  return combineFieldErrors(fieldErrors)
}

/**
 * Validate the required `faqSections` repeatable component on the faq
 * content type.
 *
 * Unlike `validateGrantPageFaqSection` above, `faqSections` is always
 * required — an absent or empty list is itself an error, not a valid
 * "not rendered" state. Every section requires a non-empty `heading` and at
 * least one item; every item requires a non-empty `question` and `answer`.
 *
 * Returns a `ValidationError` combining every failing field, `undefined` on success.
 */
export function validateFaqSections(
  body: unknown
): errors.ValidationError | undefined {
  const sections = (body as Record<string, unknown>)?.faqSections
  const fieldErrors: FieldError[] = []

  if (!Array.isArray(sections) || sections.length === 0) {
    fieldErrors.push({
      message: 'FAQ Sections: At least 1 section is required',
      path: ['faqSections']
    })
    return combineFieldErrors(fieldErrors)
  }

  for (const [sectionIndex, section] of sections.entries()) {
    const { heading, items } = (section ?? {}) as Record<string, unknown>

    if (!heading || typeof heading !== 'string' || heading.trim() === '') {
      fieldErrors.push({
        message: `FAQ Sections: Section ${sectionIndex + 1} is missing a heading`,
        path: ['faqSections', sectionIndex, 'heading']
      })
    }

    if (!Array.isArray(items) || items.length === 0) {
      fieldErrors.push({
        message: `FAQ Sections: Section ${sectionIndex + 1} requires at least 1 question`,
        path: ['faqSections', sectionIndex, 'items']
      })
      continue
    }

    for (const [itemIndex, item] of items.entries()) {
      const { question, answer } = (item ?? {}) as Record<string, unknown>
      if (!question || typeof question !== 'string' || question.trim() === '') {
        fieldErrors.push({
          message: `FAQ Sections: Section ${sectionIndex + 1}, item ${itemIndex + 1} is missing a question`,
          path: ['faqSections', sectionIndex, 'items', itemIndex, 'question']
        })
      }
      if (!answer || typeof answer !== 'string' || answer.trim() === '') {
        fieldErrors.push({
          message: `FAQ Sections: Section ${sectionIndex + 1}, item ${itemIndex + 1} is missing an answer`,
          path: ['faqSections', sectionIndex, 'items', itemIndex, 'answer']
        })
      }
    }
  }

  return combineFieldErrors(fieldErrors)
}

/**
 * Validate an optional `shared.cta-link`-shaped component (or the
 * `shared.primary-cta-link` variant, which is the same shape minus `style`):
 * when absent it simply isn't rendered — that is valid. When present, both
 * `text` and `link` are required; Strapi's partial update validator skips
 * required-field checks on PUT, so this fills the gap.
 */
function validateCtaLinkField(
  body: unknown,
  fieldName: string,
  label: string
): errors.ValidationError | undefined {
  const cta = (body as Record<string, unknown>)?.[fieldName]
  if (!cta || typeof cta !== 'object') return undefined

  const { text, link } = cta as Record<string, unknown>
  const fieldErrors: FieldError[] = []
  if (!text || typeof text !== 'string' || text.trim() === '') {
    fieldErrors.push({
      message: `${label}: Text is required`,
      path: [fieldName, 'text']
    })
  }
  if (!link || typeof link !== 'string' || link.trim() === '') {
    fieldErrors.push({
      message: `${label}: Link is required`,
      path: [fieldName, 'link']
    })
  }
  return combineFieldErrors(fieldErrors)
}

/**
 * Validate the optional primaryCta component on a grant page.
 * See {@link validateCtaLinkField}.
 */
export function validateGrantPagePrimaryCta(
  body: unknown
): errors.ValidationError | undefined {
  return validateCtaLinkField(body, 'primaryCta', 'Primary Call to Action')
}

/**
 * Validate the optional cta component on a profile page.
 * See {@link validateCtaLinkField}.
 */
export function validateProfileCta(
  body: unknown
): errors.ValidationError | undefined {
  return validateCtaLinkField(body, 'cta', 'Call to Action')
}

/**
 * Validate the required ctaStrip component on grant-page and
 * grant-overview-page (`blocks.cta-strip`).
 *
 * Unlike primaryCta/faqSection above, ctaStrip itself is `required: true` on
 * both content types, so an absent ctaStrip is an error, not a valid
 * "not rendered" state.
 *
 * Returns a `ValidationError` combining every failing field, `undefined` on success.
 */
export function validateCtaStrip(
  body: unknown
): errors.ValidationError | undefined {
  const ctaStrip = (body as Record<string, unknown>)?.ctaStrip
  if (!ctaStrip || typeof ctaStrip !== 'object') {
    return combineFieldErrors([
      { message: 'CTA Strip is required', path: ['ctaStrip'] }
    ])
  }

  const { heading, description, primaryButtonText, primaryButtonLink } =
    ctaStrip as Record<string, unknown>
  const fieldErrors: FieldError[] = []

  if (!heading || typeof heading !== 'string' || heading.trim() === '') {
    fieldErrors.push({
      message: 'CTA Strip: Heading is required',
      path: ['ctaStrip', 'heading']
    })
  }
  if (
    !description ||
    typeof description !== 'string' ||
    description.trim() === ''
  ) {
    fieldErrors.push({
      message: 'CTA Strip: Description is required',
      path: ['ctaStrip', 'description']
    })
  }
  if (
    !primaryButtonText ||
    typeof primaryButtonText !== 'string' ||
    primaryButtonText.trim() === ''
  ) {
    fieldErrors.push({
      message: 'CTA Strip: Primary Button Text is required',
      path: ['ctaStrip', 'primaryButtonText']
    })
  }
  if (
    !primaryButtonLink ||
    typeof primaryButtonLink !== 'string' ||
    primaryButtonLink.trim() === ''
  ) {
    fieldErrors.push({
      message: 'CTA Strip: Primary Button Link is required',
      path: ['ctaStrip', 'primaryButtonLink']
    })
  }
  return combineFieldErrors(fieldErrors)
}

/**
 * Validate the optional infoCards component on a grant page.
 *
 * When `infoCards` is absent the section is simply not rendered — that is
 * valid. When it is present, all three cards and their heading/body fields
 * are required; Strapi's partial update validator skips required-field
 * checks on PUT, so this fills the gap.
 *
 * Returns a `ValidationError` combining every failing field, `undefined` on success.
 */
export function validateGrantInfoCards(
  body: unknown
): errors.ValidationError | undefined {
  const infoCards = (body as Record<string, unknown>)?.infoCards
  if (!infoCards || typeof infoCards !== 'object') return undefined

  const fieldErrors: FieldError[] = []

  for (const key of ['card1', 'card2', 'card3'] as const) {
    const card = (infoCards as Record<string, unknown>)[key] as
      | Record<string, unknown>
      | undefined
    if (!card || typeof card !== 'object') {
      fieldErrors.push({
        message: `Information Cards: ${key} is required`,
        path: ['infoCards', key]
      })
      continue
    }
    if (
      !card.heading ||
      typeof card.heading !== 'string' ||
      card.heading.trim() === ''
    ) {
      fieldErrors.push({
        message: `Information Cards: ${key} heading is required`,
        path: ['infoCards', key, 'heading']
      })
    }
    if (
      !card.body ||
      typeof card.body !== 'string' ||
      card.body.trim() === ''
    ) {
      fieldErrors.push({
        message: `Information Cards: ${key} body is required`,
        path: ['infoCards', key, 'body']
      })
    }
  }
  return combineFieldErrors(fieldErrors)
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
 * summit-page): title is required, and each CTA needs both text and link.
 *
 * Returns a `ValidationError` combining every failing field, `undefined` when hero is absent or valid.
 */
export function validateHeroFields(
  page: Pick<PageData, 'hero'>
): errors.ValidationError | undefined {
  const hero = page.hero
  if (!hero) return undefined

  const fieldErrors: FieldError[] = []
  if (!hero.title?.trim()) {
    fieldErrors.push({
      message: 'Hero is missing required title',
      path: ['hero', 'title']
    })
  }
  const cta = hero.hero_call_to_action
  if (cta) {
    if (!cta.text) {
      fieldErrors.push({
        message: 'Hero CTA is missing required text',
        path: ['hero', 'hero_call_to_action', 'text']
      })
    }
    if (!cta.link) {
      fieldErrors.push({
        message: 'Hero CTA is missing required link',
        path: ['hero', 'hero_call_to_action', 'link']
      })
    }
  }
  return combineFieldErrors(fieldErrors)
}

/**
 * Validate a blog post's Article Bio and Related Articles components. Both
 * fields are marked `required` in their component schemas, so Strapi
 * enforces them on create; this fills the same partial-update gap as the
 * other validators here.
 *
 * Returns a `ValidationError` combining every missing field found, `undefined` otherwise.
 */
export function validateBlogFields(post: {
  articleBio?: { author: string | null }[]
  relatedArticles?: { slug: string }[]
}): errors.ValidationError | undefined {
  const fieldErrors: FieldError[] = []
  for (const [i, bio] of (post.articleBio ?? []).entries()) {
    if (!bio.author?.trim()) {
      fieldErrors.push({
        message: 'Author Bio: Name is required',
        path: ['articleBio', i, 'author']
      })
    }
  }
  for (const [i, related] of (post.relatedArticles ?? []).entries()) {
    if (!related.slug) {
      fieldErrors.push({
        message: 'Related Articles: Slug is required',
        path: ['relatedArticles', i, 'slug']
      })
    }
  }
  return combineFieldErrors(fieldErrors)
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
 * Returns a `ValidationError` combining every missing label found, `undefined` otherwise.
 */
export function validateNavigationLabels(
  data: NavigationData
): errors.ValidationError | undefined {
  const fieldErrors: FieldError[] = []

  for (const [groupIndex, group] of (data.mainMenu ?? []).entries()) {
    if (!group.label?.trim()) {
      fieldErrors.push({
        message: `Main Menu: Item ${groupIndex + 1} is missing a required label`,
        path: ['mainMenu', groupIndex, 'label']
      })
    }
    for (const [itemIndex, item] of (group.items ?? []).entries()) {
      if (!item.label?.trim()) {
        fieldErrors.push({
          message: `"${group.label}": Item ${itemIndex + 1} is missing a required label`,
          path: ['mainMenu', groupIndex, 'items', itemIndex, 'label']
        })
      }
    }
    for (const [subGroupIndex, subGroup] of (group.subGroups ?? []).entries()) {
      if (!subGroup.label?.trim()) {
        fieldErrors.push({
          message: `"${group.label}": Sub-group ${subGroupIndex + 1} is missing a required label`,
          path: ['mainMenu', groupIndex, 'subGroups', subGroupIndex, 'label']
        })
      }
      for (const [itemIndex, item] of (subGroup.items ?? []).entries()) {
        if (!item.label?.trim()) {
          fieldErrors.push({
            message: `"${group.label}" / "${subGroup.label}": Item ${itemIndex + 1} is missing a required label`,
            path: [
              'mainMenu',
              groupIndex,
              'subGroups',
              subGroupIndex,
              'items',
              itemIndex,
              'label'
            ]
          })
        }
      }
    }
  }

  if (data.ctaButton && !data.ctaButton.label?.trim()) {
    fieldErrors.push({
      message: 'CTA Button: Label is required',
      path: ['ctaButton', 'label']
    })
  }

  return combineFieldErrors(fieldErrors)
}
