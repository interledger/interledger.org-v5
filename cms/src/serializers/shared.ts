import jsesc from 'jsesc'

// `minimal: true` escapes only what's strictly required (the matching quote,
// backslashes, control chars, line/paragraph separators) and leaves printable
// Unicode intact — so localized content (e.g. Spanish accents) survives the
// MDX export → import round-trip instead of becoming \xNN escapes.

/** Escapes a string for use in a JSX double-quoted attribute value. */
export const escDouble = (v: string): string =>
  v ? jsesc(v, { quotes: 'double', minimal: true }) : ''

/** Escapes a string for use in a JSX single-quoted attribute value. */
export const escSingle = (v: string): string =>
  v ? jsesc(v, { quotes: 'single', minimal: true }) : ''
