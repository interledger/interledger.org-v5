/**
 * Strict error model for the MDX block parser.
 *
 * The parser fails loudly on unsupported syntax rather than silently
 * dropping content. Every error carries enough context (component name,
 * position, reason) for the caller to produce actionable diagnostics.
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const ParserErrorCode = {
  /** JSX component not in the supported handler registry. */
  UNSUPPORTED_COMPONENT: 'UNSUPPORTED_COMPONENT',

  /** A required prop is missing from a JSX element. */
  MISSING_REQUIRED_PROP: 'MISSING_REQUIRED_PROP',

  /** A prop value has an unexpected type or format. */
  INVALID_PROP_VALUE: 'INVALID_PROP_VALUE',

  /** A JSX expression (`{...}`) could not be statically evaluated. */
  DYNAMIC_EXPRESSION: 'DYNAMIC_EXPRESSION',

  /** MDX AST could not be parsed by remark + remark-mdx. */
  MDX_PARSE_ERROR: 'MDX_PARSE_ERROR',

  /** Relation slug could not be resolved to a Strapi document ID. */
  UNRESOLVED_RELATION: 'UNRESOLVED_RELATION',

  /** Conflicting props (e.g. both children and content on Paragraph). */
  CONFLICTING_PROPS: 'CONFLICTING_PROPS',

  /** Nested JSX inside a Paragraph block (silent content corruption). */
  NESTED_JSX: 'NESTED_JSX'
} as const

export type ParserErrorCode =
  (typeof ParserErrorCode)[keyof typeof ParserErrorCode]

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export interface ParserErrorContext {
  /** Error classification. */
  code: ParserErrorCode
  /** Human-readable explanation. */
  message: string
  /** JSX component name (e.g. "Ambassador"), if applicable. */
  component?: string
  /** Prop name that caused the error, if applicable. */
  prop?: string
  /** 1-based line number in the source MDX, if available. */
  line?: number
  /** 1-based column number in the source MDX, if available. */
  column?: number
}

/**
 * Returned by the MDX block parser and block handlers on any irrecoverable
 * parsing issue. Callers narrow with `instanceof MdxParserError` and surface
 * the structured context for debugging.
 */
export class MdxParserError extends Error {
  public readonly code: ParserErrorCode
  public readonly component?: string
  public readonly prop?: string
  public readonly line?: number
  public readonly column?: number

  constructor(ctx: ParserErrorContext) {
    const location =
      ctx.line != null ? ` (line ${ctx.line}:${ctx.column ?? 0})` : ''
    const prefix = ctx.component ? `[${ctx.component}]` : '[parser]'
    super(`${prefix}${location} ${ctx.message}`)

    this.name = 'MdxParserError'
    this.code = ctx.code
    this.component = ctx.component
    this.prop = ctx.prop
    this.line = ctx.line
    this.column = ctx.column
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run an async fn and convert thrown `MdxParserError` into a returned value.
 * Other thrown values (network, programmer bugs) propagate so the caller
 * can decide how to surface them.
 *
 * Companion to `tryCatchAsync` in `cms/src/utils/tryCatch.ts`, narrowed to
 * `MdxParserError` so handler/parser return types stay precisely typed
 * as `T | MdxParserError` rather than the broader `T | Error`.
 */
export async function tryCatchParserError<T>(
  fn: () => T | Promise<T>
): Promise<T | MdxParserError> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof MdxParserError) return err
    throw err
  }
}
