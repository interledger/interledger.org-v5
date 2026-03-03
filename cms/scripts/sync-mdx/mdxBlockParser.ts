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
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'

import type { ParsedBlock } from './types.blocks'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  node: MdxJsxFlowElement,
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
}

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/** Map of JSX component name → handler function. */
const COMPONENT_HANDLERS: Record<string, ComponentHandler> = {}

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
    if (node.type === 'mdxJsxFlowElement') {
      const jsxNode = node as MdxJsxFlowElement
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
 * Register a component handler. Called by individual handler modules
 * during their initialization.
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
