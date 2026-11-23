/**
 * The Path Slug input's behaviour (INTORG-574), kept out of the React
 * component so it can be tested. Save applies the same correction and the
 * same check, so the input only shows the editor early what save will do.
 */
import {
  isPathSlugFormatMessage,
  pathSlugFormatError,
  toCanonicalPathSlug
} from './relativeLinks'

/** The field uid on the content-type schemas. Matches `cms/config/plugins.ts`. */
export const PATH_SLUG_CUSTOM_FIELD = 'plugin::path-slug.path-slug'

/**
 * The value to put in the field when the editor leaves it: `About Us`
 * becomes `/about-us/`. `undefined` when there is nothing to change, so a
 * blur on a valid slug doesn't mark the form as modified.
 */
export function pathSlugOnBlur(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const corrected = toCanonicalPathSlug(value)
  return corrected === value ? undefined : corrected
}

/**
 * The message under the field. Hidden until the editor leaves it or a save
 * fails, so typing `/about-us/` doesn't flash red on the first character.
 * The admin keeps a failed save's errors until the next save, so our format
 * message is dropped once the editor has fixed the value. Other messages
 * (`required`, a slug already in use) stay, as does ours on a blank value.
 */
export function visiblePathSlugError(
  value: unknown,
  formError: string | undefined,
  touched: boolean
): string | undefined {
  if (!touched && !formError) return undefined
  if (typeof value !== 'string') return formError
  const current = pathSlugFormatError(value)
  if (current) return current
  const fixed = value.trim() !== ''
  if (fixed && formError && isPathSlugFormatMessage(formError)) return undefined
  return formError
}
