// JSX attribute values are not JS strings: a backslash-escaped quote (\") is a
// parse error in MDX, so we can't use jsesc here. Instead we HTML-entity encode
// the characters that would break a quoted JSX attribute. The MDX parser
// decodes these entities back to their literal form on import, so the
// export -> import round-trip is preserved. Printable Unicode (e.g. localized
// accents) passes through untouched.

const escapeForAttr = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Escapes a string for use in a JSX double-quoted attribute value. */
export const escDouble = (v: string): string =>
  v ? escapeForAttr(v).replace(/"/g, '&quot;') : ''

/** Escapes a string for use in a JSX single-quoted attribute value. */
export const escSingle = (v: string): string =>
  v ? escapeForAttr(v).replace(/'/g, '&#39;') : ''
