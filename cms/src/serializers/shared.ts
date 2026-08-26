// JSX attribute values are not JS strings: a backslash-escaped quote (\") is a
// parse error in MDX, so we can't use jsesc here. Instead we HTML-entity encode
// the characters that would break a quoted JSX attribute. The MDX parser
// decodes these entities back to their literal form on import, so the
// export -> import round-trip is preserved. Printable Unicode (e.g. localized
// accents) passes through untouched.
//
// Newlines are encoded as &#10; so multi-line Strapi text fields (e.g. Event
// Card location addresses) never emit a literal line break inside a quoted
// attribute — that breaks some MDX/tooling paths even when micromark accepts it.

const escapeForAttr = (v: string): string =>
  v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Normalize CRLF/CR first so we don't double-encode
    .replace(/\r\n/g, '&#10;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#10;')

/** Escapes a string for use in a JSX double-quoted attribute value. */
export const escDouble = (v: string): string =>
  v ? escapeForAttr(v).replace(/"/g, '&quot;') : ''

/** Escapes a string for use in a JSX single-quoted attribute value. */
export const escSingle = (v: string): string =>
  v ? escapeForAttr(v).replace(/'/g, '&#39;') : ''

// MDX (`@mdx-js/mdx` v3) strips a fixed 2 columns of leading whitespace from
// every continuation line of a multi-line template literal used as a JSX
// attribute value (e.g. `code={`...`}`), regardless of that line's actual
// indentation. Prepending 2 spaces to every non-blank continuation line
// exactly cancels the strip: max(0, (n + 2) - 2) === n for any n >= 0. The
// first line is untouched — it shares a physical source line with the
// opening backtick, so MDX doesn't treat it as a continuation line.
export const padMdxAttrTemplateLiteral = (code: string): string =>
  code
    .split('\n')
    .map((line, i) => (i > 0 && line.trim().length > 0 ? `  ${line}` : line))
    .join('\n')

export const escMdxBraces = (v: string): string =>
  v ? v.trim().replace(/\{/g, '\\{').replace(/\}/g, '\\}') : ''

// Inverse of escMdxBraces, for undoing it after raw-slicing MDX source.
export const unescapeMdxBraces = (v: string): string =>
  v.replace(/\\([{}])/g, '$1')
