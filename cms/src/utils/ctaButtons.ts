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
 * Check the composition rules Sarah specified on INTORG-938 (2026-07-29):
 * one or two buttons, never two primaries, and a primary must come first.
 *
 * Returns `null` when the set is valid. Field-level problems (missing text or
 * link) are deliberately not checked here — the serializer reports those with
 * their own per-field paths.
 */
export function validateCtaButtonComposition(
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

  // An unset style means the schema default, which is primary.
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
