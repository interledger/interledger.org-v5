import jsesc from 'jsesc'

/** Escapes a string for use in a JSX double-quoted attribute value. */
export const escDouble = (v: string): string =>
  v ? jsesc(v, { quotes: 'double' }) : ''

/** Escapes a string for use in a JSX single-quoted attribute value. */
export const escSingle = (v: string): string =>
  v ? jsesc(v, { quotes: 'single' }) : ''
