/** Maps Constraint Validation flags to a field error kind. */
export type ConstraintErrorKind = 'required' | 'invalid'

/** Requires local@domain.tld — stricter than the HTML5 type=email built-in check. */
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return EMAIL_ADDRESS_PATTERN.test(trimmed)
}

export function constraintErrorKind(
  validity: Pick<ValidityState, 'valueMissing' | 'typeMismatch'>
): ConstraintErrorKind | null {
  if (validity.valueMissing) return 'required'
  if (validity.typeMismatch) return 'invalid'
  return null
}

export function emailConstraintErrorKind(
  value: string,
  validity: Pick<ValidityState, 'valueMissing' | 'typeMismatch'>
): ConstraintErrorKind | null {
  if (validity.valueMissing || value.trim() === '') return 'required'
  // Surrounding whitespace can set typeMismatch even when the trimmed
  // address is valid. isValidEmailAddress already trims, so it is the
  // source of truth — not the browser flag.
  if (!isValidEmailAddress(value)) return 'invalid'
  return null
}
