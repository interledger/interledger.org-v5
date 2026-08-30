/** Test fixture for building a partial ValidityState. Not covered by tests itself. */
export function validity(flags: {
  valueMissing?: boolean
  typeMismatch?: boolean
}): Pick<ValidityState, 'valueMissing' | 'typeMismatch'> {
  return {
    valueMissing: flags.valueMissing ?? false,
    typeMismatch: flags.typeMismatch ?? false
  }
}
