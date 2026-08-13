/**
 * Shared definitions for the CTA Buttons block (INTORG-907).
 *
 * The composition rules cannot be expressed in a Strapi schema, so they are
 * enforced in code on both write paths: the MDX parser on import, and the
 * document-service validator on admin save. Both import from here so the two
 * can't drift.
 */

export const CTA_BUTTON_STYLES = ['primary', 'secondary'] as const
export type CtaButtonStyle = (typeof CTA_BUTTON_STYLES)[number]

/** Design allows a single CTA or two side by side, never more. */
export const MIN_CTA_BUTTONS = 1
export const MAX_CTA_BUTTONS = 2

export interface CtaButtonEntry {
  text?: string
  link?: string
  style?: string
  external?: boolean
  document?: boolean
}

export function isCtaButtonStyle(value: unknown): value is CtaButtonStyle {
  return CTA_BUTTON_STYLES.includes(value as CtaButtonStyle)
}

/**
 * External and document are mutually exclusive: they pick different icons, and
 * the native `download` attribute is ignored cross-origin anyway, so the pair
 * promises something the browser won't deliver. Matches the rule card-grid
 * already enforces on its secondary CTAs.
 */
export function hasConflictingCtaFlags(button: CtaButtonEntry): boolean {
  return Boolean(button.external && button.document)
}

/**
 * A composition failure, with the index of the offending button when one
 * button is to blame (`null` when it's the set as a whole).
 */
export interface CtaButtonsRuleError {
  index: number | null
  message: string
}

/**
 * Check how many buttons the block has: at least one, at most two.
 *
 * Split out from the style rules because a caller that reports field-level
 * problems needs to know it has a usable array before it inspects the entries,
 * but must not judge styles yet. See `validateCtaButtonStyles`.
 */
export function validateCtaButtonCount(
  buttons: CtaButtonEntry[] | undefined
): CtaButtonsRuleError | null {
  if (!Array.isArray(buttons) || buttons.length < MIN_CTA_BUTTONS) {
    return { index: null, message: 'CTA Buttons needs at least one button.' }
  }

  if (buttons.length > MAX_CTA_BUTTONS) {
    return {
      index: null,
      message: `CTA Buttons supports at most ${MAX_CTA_BUTTONS} buttons, received ${buttons.length}.`
    }
  }

  return null
}

/**
 * Check the style rules Sarah specified on INTORG-938 (2026-07-29): never two
 * primaries, and a primary must come first.
 *
 * An unset style counts as primary, because that is the schema default. So an
 * empty half-filled draft looks like two primaries. Run field validation
 * before this, or the editor is told to fix a style they never chose
 * (Jonathan, #483).
 */
export function validateCtaButtonStyles(
  buttons: CtaButtonEntry[]
): CtaButtonsRuleError | null {
  const styleAt = (i: number) => buttons[i]?.style ?? 'primary'

  const primaryCount = buttons.filter((_, i) => styleAt(i) === 'primary').length
  if (primaryCount > 1) {
    return {
      index: 1,
      message:
        'Two buttons cannot both be primary. Use one primary and one secondary, or two secondary.'
    }
  }

  if (buttons.length === MAX_CTA_BUTTONS && styleAt(1) === 'primary') {
    return {
      index: 1,
      message:
        'The primary button must come first. Put the primary button before the secondary one.'
    }
  }

  return null
}

/**
 * Both composition checks in order: the count, then the styles.
 *
 * The MDX parser uses this, because it has already rejected any entry with a
 * missing text or link before it gets here. The serializer runs the two halves
 * separately so it can report field problems in between.
 *
 * Returns `null` when the set is valid.
 */
export function validateCtaButtonComposition(
  buttons: CtaButtonEntry[] | undefined
): CtaButtonsRuleError | null {
  return (
    validateCtaButtonCount(buttons) ??
    validateCtaButtonStyles(buttons as CtaButtonEntry[])
  )
}
