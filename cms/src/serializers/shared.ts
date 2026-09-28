// JSX attribute values are not JS strings: a backslash-escaped quote (\") is a
// parse error in MDX, so we can't use jsesc here. Instead we HTML-entity encode
// the few characters that would break a quoted JSX attribute, or that the MDX
// parser would otherwise read as something other than what the author typed.
// The parser decodes these entities back to their literal form on import, so
// the export -> import round-trip is preserved. Everything else — `<`, `>`,
// a bare `&`, printable Unicode — passes through untouched, because a quoted
// attribute value ends at its closing quote and nothing between the quotes
// needs protecting (INTORG-1242).
//
// Newlines are encoded as &#10; so multi-line Strapi text fields (e.g. Event
// Card location addresses) never emit a literal line break inside a quoted
// attribute — that breaks some MDX/tooling paths even when micromark accepts it.

// An `&` only needs escaping when the text after it would be decoded as a
// character reference, i.e. `&amp;` typed literally by an author. A `&` in an
// ordinary value — `Q & A`, `?v=abc&list=xyz` — is left alone: encoding it
// produced the `&amp;` that made exported MDX hard to translate.
//
// This matches the two reference forms that always end in a semicolon. HTML
// also decodes 106 legacy names without one (`&not` -> `¬`), so the literal
// text `&notReal;` still re-imports as `¬Real;`. Covering that needs the
// named-reference tables as direct dependencies, which is not worth it for a
// string that no page title, button label or alt text has ever held.
const CHARACTER_REFERENCE_START =
  /&(?=#[0-9]+;|#[xX][0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]*;)/g

const escapeForAttr = (v: string): string =>
  v
    .replace(CHARACTER_REFERENCE_START, '&amp;')
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

// Inverse of padMdxAttrTemplateLiteral, for undoing it when a CodeBlock's
// `code` attribute is read back out of raw `.mdx` source (see
// cms/scripts/sync-mdx/codeBlockHandler.ts). Without this, re-importing an
// exported `.mdx` file feeds the already-padded code back into Strapi, and
// the next export pads it again — compounding 2 spaces per cycle.
export const unpadMdxAttrTemplateLiteral = (code: string): string =>
  code
    .split('\n')
    .map((line, i) => (i > 0 ? line.replace(/^ {1,2}/, '') : line))
    .join('\n')

/**
 * Escapes a string for use as MDX body text — a markdown heading, say — rather
 * than as a JSX attribute value.
 *
 * Only `<` and `>` need it. An unescaped `<2026>` makes MDX try to read a JSX
 * tag and fail the parse. A backslash is the escape to reach for, not `&lt;`:
 * both parse back to the same character, and the backslash keeps the file
 * readable for a translator (INTORG-1242). `&` and `"` are ordinary text in
 * markdown and are left alone.
 */
export const escMdxAngleBrackets = (v: string): string =>
  v.replace(/([<>])/g, '\\$1')

export const escMdxBraces = (v: string): string =>
  v ? v.trim().replace(/\{/g, '\\{').replace(/\}/g, '\\}') : ''

// Inverse of escMdxBraces, for undoing it after raw-slicing MDX source.
export const unescapeMdxBraces = (v: string): string =>
  v.replace(/\\([{}])/g, '$1')
