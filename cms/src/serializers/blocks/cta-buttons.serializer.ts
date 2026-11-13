import {
  SerializerFieldError,
  hasConflictingCtaFlags,
  isCtaButtonStyle,
  serializeIntroProp,
  validateCtaButtonCount,
  validateCtaButtonStyles,
  type BlockIntroInput,
  type CtaButtonEntry,
  type CtaButtonsRuleError,
  type FieldError
} from '../../utils'

/**
 * Validate one button. Returns every failing field so an editor sees all of
 * them at once rather than fixing one per save.
 */
function validateButton(button: CtaButtonEntry, index: number): FieldError[] {
  const position = index + 1
  const fieldErrors: FieldError[] = []

  if (!button.text || !button.text.trim())
    fieldErrors.push({
      message: `Button ${position} is missing its text`,
      path: ['buttons', index, 'text']
    })

  if (!button.link || !button.link.trim())
    fieldErrors.push({
      message: `Button ${position} is missing a link`,
      path: ['buttons', index, 'link']
    })

  if (button.style !== undefined && !isCtaButtonStyle(button.style))
    fieldErrors.push({
      message: `Button ${position} has an unknown style "${button.style}". Use primary or secondary.`,
      path: ['buttons', index, 'style']
    })

  if (hasConflictingCtaFlags(button))
    fieldErrors.push({
      message: `Button ${position} cannot be both external and document`,
      path: ['buttons', index, 'document']
    })

  return fieldErrors
}

/** Wrap a composition failure in the field path the admin anchors it to. */
function toFieldError(error: CtaButtonsRuleError): SerializerFieldError {
  return new SerializerFieldError([
    {
      message: error.message,
      path:
        error.index === null ? ['buttons'] : ['buttons', error.index, 'style']
    }
  ])
}

/** A validated button, as written to the `buttons={[…]}` MDX prop. */
export interface SerializedCtaButton {
  text: string
  link: string
  style: string
  external?: true
  document?: true
}

/**
 * Validates a CTA button group (shared by CtaButtons and SplitLayout) and
 * returns its MDX entries. Throws `SerializerFieldError` with paths under
 * `buttons`, so the admin anchors each error to the right button.
 */
export function serializeCtaButtonEntries(
  buttons: CtaButtonEntry[] | undefined
): SerializedCtaButton[] {
  // Strapi's required/min/max constraints aren't enforced on save, and the
  // composition rules can't be expressed in the schema at all.
  //
  // Order matters. An unset style counts as primary, so two empty buttons in a
  // half-finished draft look like two primaries. Checking styles first would
  // tell the editor to fix a style they never chose, when the real problem is
  // that neither button has any text. So: count, then fields, then styles
  // (Jonathan, #483).
  const countError = validateCtaButtonCount(buttons)
  if (countError) throw toFieldError(countError)

  // The count check above guarantees a non-empty array from here on.
  const validButtons = buttons as CtaButtonEntry[]

  const fieldErrors = validButtons.flatMap(validateButton)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  const styleError = validateCtaButtonStyles(validButtons)
  if (styleError) throw toFieldError(styleError)

  return validButtons.map((button) => ({
    text: button.text!.trim(),
    link: button.link!.trim(),
    style: button.style ?? 'primary',
    // Only emit the flags when set, so a default-valued button round-trips to
    // the same MDX it came from.
    ...(button.external ? { external: true } : {}),
    ...(button.document ? { document: true } : {})
  }))
}

export function serialize(block: {
  intro?: BlockIntroInput | null
  buttons?: CtaButtonEntry[]
}): string {
  const entries = serializeCtaButtonEntries(block.buttons)
  const introAttr = serializeIntroProp(block.intro)
  return `<CtaButtons${introAttr} buttons={${JSON.stringify(entries)}} />`
}
