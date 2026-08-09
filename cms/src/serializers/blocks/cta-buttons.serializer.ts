import {
  SerializerFieldError,
  hasConflictingCtaFlags,
  isCtaButtonStyle,
  validateCtaButtonComposition,
  type CtaButtonEntry,
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

export function serialize(block: { buttons?: CtaButtonEntry[] }): string {
  // Strapi's required/min/max constraints aren't enforced on save, and the
  // composition rules can't be expressed in the schema at all.
  const ruleError = validateCtaButtonComposition(block.buttons)
  if (ruleError) {
    throw new SerializerFieldError([
      {
        message: ruleError.message,
        path:
          ruleError.index === null
            ? ['buttons']
            : ['buttons', ruleError.index, 'style']
      }
    ])
  }

  // The rule check above guarantees a non-empty array from here on.
  const buttons = block.buttons as CtaButtonEntry[]

  const fieldErrors = buttons.flatMap(validateButton)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  const entries = buttons.map((button) => ({
    text: button.text!.trim(),
    link: button.link!.trim(),
    style: button.style ?? 'primary',
    // Only emit the flags when set, so a default-valued button round-trips to
    // the same MDX it came from.
    ...(button.external ? { external: true } : {}),
    ...(button.document ? { document: true } : {})
  }))

  return `<CtaButtons buttons={${JSON.stringify(entries)}} />`
}
