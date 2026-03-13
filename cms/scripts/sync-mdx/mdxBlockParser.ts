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
 *   props produce hard errors via `MdxParserError`.
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
 * etc.) and returns one or more block payloads.
 *
 * Handlers are async to support relation lookups (e.g. ambassador slug
 * resolution).
 */
export type ComponentHandler = (
  node: JsxBlockNode,
  ctx: ParserContext
) => Promise<ParsedBlock[]>

/**
 * Context passed to component handlers during parsing.
 *
 * Contains the services handlers may need (e.g. relation resolver).
 */
export interface ParserContext {
  /** Locale of the MDX file being parsed. */
  locale: string
  /**
   * Resolve a relation slug to a Strapi document ID.
   * Provided by the caller for handlers that reference other content types.
   *
   * @param apiId - Strapi API identifier (e.g. 'ambassadors')
   * @param slug  - Content slug to look up
   */
  resolveRelation?: (
    apiId: string,
    slug: string
  ) => Promise<{ documentId: string }>
  /**
   * Resolve an internal upload path to a Strapi upload file integer ID.
   * Same pattern as resolveRelation — wraps strapi.findUploadByUrl.
   *
   * @param url - Internal path (e.g. '/uploads/file.pdf')
   */
  resolveMediaUpload?: (url: string) => Promise<number>
}

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/**
 * Singleton handler registry: JSX component name → handler function.
 *
 * This is a module-level object — Node's module cache guarantees only one
 * instance exists per process. Handler modules (e.g. ambassadorHandler.ts)
 * call `registerComponentHandler()` at the top level, so importing the
 * module is enough to populate this map (side-effect registration).
 *
 * The pipeline triggers registration via bare imports in config.ts:
 *   import './ambassadorHandler'  // populates COMPONENT_HANDLERS['Ambassador']
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
 * @example
 * ```ts
 * // Given MDX body:
 * //   <Ambassador slug="caroline-sinders" showLinks={false} />
 * //   <AmbassadorGrid heading="Our Team" slugs={["alice","bob"]} />
 * //
 * // Returns (once handlers are registered):
 * // [
 * //   { __component: 'blocks.ambassador', ambassador: { documentId: '...' }, showLinks: false },
 * //   { __component: 'blocks.ambassadors-grid', heading: 'Our Team', ambassadors: [...] }
 * // ]
 *
 * const blocks = await parseMdxToBlocks(mdxBody, { locale: 'en' })
 * ```
 *
 * @param mdxBody - Raw MDX body content (no frontmatter)
 * @param ctx - Parser context (locale, services, etc.)
 * @returns Ordered array of block payloads ready for Strapi import
 *
 * @throws {MdxParserError} on unsupported JSX, bad props, parse errors
 */
export async function parseMdxToBlocks(
  mdxBody: string,
  ctx: ParserContext
): Promise<ParsedBlock[]> {
  if (!mdxBody.trim()) return []

  // Parse MDX into AST.
  // unified() creates the processing pipeline that remark plugins attach to.
  // remarkParse adds markdown parsing, remarkMdx extends it with JSX syntax
  // support (<Component />, {expressions}). The .parse() call produces the
  // AST without running any transforms.
  let tree: Root
  try {
    tree = unified().use(remarkParse).use(remarkMdx).parse(mdxBody)
  } catch (err) {
    throw new MdxParserError({
      code: ParserErrorCode.MDX_PARSE_ERROR,
      message: `Failed to parse MDX: ${err instanceof Error ? err.message : String(err)}`
    })
  }

  const blocks: ParsedBlock[] = []

  // Walk top-level AST nodes
  for (const node of tree.children) {
    // Check for JSX — either a top-level flow element (tags on separate
    // lines / self-closing) or a paragraph wrapping a single text element
    // (open+close tags on the same line).
    const jsxNode: JsxBlockNode | undefined =
      node.type === 'mdxJsxFlowElement' ? node : unwrapTextElement(node)

    if (jsxNode) {
      const componentName = jsxNode.name

      if (!componentName) {
        throw new MdxParserError({
          code: ParserErrorCode.UNSUPPORTED_COMPONENT,
          message:
            'Encountered a JSX fragment (<>...</>). Fragments are not supported.',
          line: jsxNode.position?.start.line,
          column: jsxNode.position?.start.column
        })
      }

      const handler = COMPONENT_HANDLERS[componentName]
      if (!handler) {
        throw new MdxParserError({
          code: ParserErrorCode.UNSUPPORTED_COMPONENT,
          message: `Unsupported JSX component "${componentName}".`,
          component: componentName,
          line: jsxNode.position?.start.line,
          column: jsxNode.position?.start.column
        })
      }

      const result = await handler(jsxNode, ctx)
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
      throw new MdxParserError({
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
      throw new MdxParserError({
        code: ParserErrorCode.DYNAMIC_EXPRESSION,
        message: `Import/export statements are not supported: "${esm.value ?? '...'}"`,
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    // Markdown nodes (paragraph, heading, thematic break, etc.) —
    // extract source text and wrap as a paragraph block. Will be
    // replaced by a dedicated Paragraph component handler.
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
        blocks.push({ __component: 'blocks.paragraph' as const, content: raw })
      }
    }
  }

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
