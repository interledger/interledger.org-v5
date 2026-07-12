/**
 * MDX Block Parser
 *
 * Parses MDX body content into an ordered array of Strapi dynamic-zone
 * block payloads using remark + remark-mdx AST walking.
 *
 * Entry point: `parseMdxToBlocks()`
 *
 * Design:
 * - AST-first: parse once, walk once, map each node to a block handler.
 * - Strict: unsupported JSX, dynamic expressions, and missing required
 *   props produce hard errors via `MdxParserError`, surfaced as a returned
 *   value (errors-as-values, see CLAUDE.md "Errors as Values").
 * - Extensible: component handlers are registered in `COMPONENT_HANDLERS`
 *   and new components only need a handler function + type entry.
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import type { Root } from 'mdast'
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'

import type { ParsedBlock } from './types.blocks'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * JSX element node that component handlers receive.
 *
 * A union of flow elements (tags on separate lines) and text elements
 * (open+close on the same line). Both share `name`, `attributes`,
 * `children`, and `position` — handlers never inspect `type`.
 */
export type JsxBlockNode = MdxJsxFlowElement | MdxJsxTextElement

/**
 * Handler for a single JSX component.
 *
 * Receives the AST node and an opaque context (for relation resolution
 * etc.) and returns one or more block payloads, or an `MdxParserError`
 * if the input fails validation. Handlers do not throw `MdxParserError`
 * to their caller; they catch their own internal throws and return them.
 *
 * Handlers are async to support relation lookups (e.g. profile pathSlug
 * resolution).
 */
export type ComponentHandler = (
  node: JsxBlockNode,
  ctx: ParserContext
) => Promise<ParsedBlock[] | MdxParserError>

/**
 * Context passed to component handlers during parsing.
 *
 * Contains the services handlers may need (e.g. relation resolver).
 */
export interface ParserContext {
  /** Locale of the MDX file being parsed. */
  locale: string
  /**
   * Original MDX source text. When provided, handlers can use AST position
   * offsets to extract raw content instead of re-serializing from the AST,
   * avoiding lossy transformations (HTML entity decoding, bracket escaping).
   */
  sourceText?: string
  /**
   * Internal parser flag: false when `sourceText` was filled from `mdxBody`.
   * Some handlers use parser-provided source only for JSX attribute recovery,
   * while caller-provided sourceText means "preserve raw markdown exactly".
   */
  sourceTextWasProvided?: boolean
  /**
   * Resolve a relation pathSlug to a Strapi document ID.
   * Provided by the caller for handlers that reference other content types.
   *
   * @param apiId - Strapi API identifier (e.g. 'profile-pages')
   * @param pathSlug  - Content pathSlug to look up
   */
  resolveRelation?: (
    apiId: string,
    pathSlug: string
  ) => Promise<{ documentId: string }>
  /**
   * Resolve an internal upload path to a Strapi upload file integer ID.
   * Same pattern as resolveRelation — wraps strapi.findUploadByUrl.
   *
   * @param url - Internal path (e.g. '/uploads/file.pdf')
   */
  resolveMediaUpload?: (url: string) => Promise<number>
  /**
   * Update the alternativeText (alt text) on a Strapi upload file record.
   */
  updateMediaAlt?: (id: number, alt: string | null) => Promise<void>
}

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/**
 * Singleton handler registry: JSX component name → handler function.
 *
 * This is a module-level object — Node's module cache guarantees only one
 * instance exists per process. Handler modules (e.g. profileHandler.ts)
 * call `registerComponentHandler()` at the top level, so importing the
 * module is enough to populate this map (side-effect registration).
 *
 * The pipeline triggers registration via bare imports in config.ts:
 *   import './profileHandler'  // populates COMPONENT_HANDLERS['ProfileCard']
 */
const COMPONENT_HANDLERS: Record<string, ComponentHandler> = {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect a paragraph that wraps a single JSX text element and extract it.
 *
 * When opening and closing JSX tags appear on the same line, remark-mdx
 * produces a `paragraph > mdxJsxTextElement` instead of a top-level
 * `mdxJsxFlowElement`. For block-level components (Blockquote, CalloutText,
 * etc.) this is semantically identical — the component fills the entire
 * paragraph. This helper detects that pattern and returns the inner element
 * so the main loop can dispatch it to the handler registry.
 */
function unwrapTextElement(
  node: Root['children'][number]
): JsxBlockNode | undefined {
  if (
    node.type === 'paragraph' &&
    node.children.length === 1 &&
    node.children[0].type === 'mdxJsxTextElement'
  ) {
    return node.children[0]
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

/**
 * Parse an MDX body string into an ordered array of Strapi dynamic-zone
 * block payloads.
 *
 * Returns `MdxParserError` instead of throwing on irrecoverable issues
 * (unsupported JSX, bad props, parse errors). Callers narrow with
 * `instanceof MdxParserError` before consuming the result.
 *
 * @example
 * ```ts
 * const result = await parseMdxToBlocks(mdxBody, { locale: 'en' })
 * if (result instanceof MdxParserError) {
 *   // handle parse failure
 *   return
 * }
 * // result is ParsedBlock[]
 * ```
 *
 * @param mdxBody - Raw MDX body content (no frontmatter)
 * @param ctx - Parser context (locale, services, etc.)
 * @returns Ordered array of block payloads, or `MdxParserError` on failure
 */
export async function parseMdxToBlocks(
  mdxBody: string,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  if (!mdxBody.trim()) return []
  const parserContext: ParserContext = {
    ...ctx,
    sourceText: ctx.sourceText ?? mdxBody,
    sourceTextWasProvided: ctx.sourceText !== undefined
  }

  // Parse MDX into AST.
  // unified() creates the processing pipeline that remark plugins attach to.
  // remarkParse adds markdown parsing, remarkMdx extends it with JSX syntax
  // support (<Component />, {expressions}). The .parse() call produces the
  // AST without running any transforms.
  let tree: Root
  try {
    tree = unified().use(remarkParse).use(remarkMdx).parse(mdxBody)
  } catch (err) {
    return new MdxParserError({
      code: ParserErrorCode.MDX_PARSE_ERROR,
      message: `Failed to parse MDX: ${err instanceof Error ? err.message : String(err)}`
    })
  }

  const blocks: ParsedBlock[] = []

  // Buffer for consecutive markdown nodes. Flushed as a single
  // blocks.paragraph when a JSX component interrupts or EOF is reached.
  // This prevents a post with 80 markdown nodes from producing 80 blocks.
  const pendingMarkdown: string[] = []

  function flushPending(): void {
    if (pendingMarkdown.length === 0) return
    const merged = pendingMarkdown.join('\n\n')
    if (merged.trim()) {
      blocks.push({ __component: 'blocks.paragraph' as const, content: merged })
    }
    pendingMarkdown.length = 0
  }

  // Walk top-level AST nodes
  for (const node of tree.children) {
    // Check for JSX — either a top-level flow element (tags on separate
    // lines / self-closing) or a paragraph wrapping a single text element
    // (open+close tags on the same line).
    const jsxNode: JsxBlockNode | undefined =
      node.type === 'mdxJsxFlowElement' ? node : unwrapTextElement(node)

    if (jsxNode) {
      // Flush accumulated markdown before handling the JSX component
      flushPending()

      const componentName = jsxNode.name

      if (!componentName) {
        return new MdxParserError({
          code: ParserErrorCode.UNSUPPORTED_COMPONENT,
          message:
            'Encountered a JSX fragment (<>...</>). Fragments are not supported.',
          line: jsxNode.position?.start.line,
          column: jsxNode.position?.start.column
        })
      }

      const handler = COMPONENT_HANDLERS[componentName]
      if (!handler) {
        return new MdxParserError({
          code: ParserErrorCode.UNSUPPORTED_COMPONENT,
          message: `Unsupported JSX component "${componentName}".`,
          component: componentName,
          line: jsxNode.position?.start.line,
          column: jsxNode.position?.start.column
        })
      }

      const result = await handler(jsxNode, parserContext)
      if (result instanceof MdxParserError) return result
      blocks.push(...result)
      // Skip to next node — don't let handled JSX fall through to
      // the markdown fallback which would double-emit the source text.
      continue
    }
    // Bare expressions like {someVar} or {() => fn()} are not allowed.
    if (
      node.type === 'mdxFlowExpression' ||
      node.type === 'mdxTextExpression'
    ) {
      const expr = node as { value?: string; position?: Root['position'] }
      return new MdxParserError({
        code: ParserErrorCode.DYNAMIC_EXPRESSION,
        message: `Top-level expression "{${expr.value ?? '...'}}" is not supported.`,
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    // ESM import/export statements are not allowed — MDX content in this
    // pipeline is converted to Strapi blocks, not executed as JS modules.
    if (node.type === 'mdxjsEsm') {
      const esm = node as { value?: string; position?: Root['position'] }
      return new MdxParserError({
        code: ParserErrorCode.DYNAMIC_EXPRESSION,
        message: `Import/export statements are not supported: "${esm.value ?? '...'}"`,
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    // Markdown nodes (paragraph, heading, thematic break, etc.) —
    // accumulate source text into the pending buffer. Will be flushed
    // as a single blocks.paragraph when a JSX node or EOF interrupts.
    if (
      node.position &&
      node.position.start.offset != null &&
      node.position.end.offset != null
    ) {
      const raw = mdxBody.slice(
        node.position.start.offset,
        node.position.end.offset
      )
      if (raw.trim()) {
        pendingMarkdown.push(raw)
      }
    }
  }

  // Flush any trailing markdown after the last node
  flushPending()

  return blocks
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

/**
 * Register a component handler into the singleton registry.
 *
 * Called at the top level of handler modules so that importing the module
 * is enough to make the handler available to `parseMdxToBlocks()`.
 * Node's module cache ensures each handler is registered exactly once.
 */
export function registerComponentHandler(
  name: string,
  handler: ComponentHandler
): void {
  COMPONENT_HANDLERS[name] = handler
}

/**
 * Get a read-only snapshot of registered handler names.
 * Useful for testing and diagnostics.
 */
export function getRegisteredComponents(): string[] {
  return Object.keys(COMPONENT_HANDLERS)
}
