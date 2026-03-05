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
}

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/** Map of JSX component name → handler function. */
const COMPONENT_HANDLERS: Record<string, ComponentHandler> = {}

interface PositionedNode {
  position?: Root['position']
}

function parserError(
  code: ParserErrorCode,
  message: string,
  node?: PositionedNode,
  extras: { component?: string } = {}
): MdxParserError {
  return new MdxParserError({
    code,
    message,
    component: extras.component,
    line: node?.position?.start.line,
    column: node?.position?.start.column
  })
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
    if (node.type === 'mdxJsxFlowElement') {
      const jsxNode = node
      const componentName = jsxNode.name

      if (!componentName) {
        throw parserError(
          ParserErrorCode.UNSUPPORTED_COMPONENT,
          'Encountered a JSX fragment (<>...</>). Fragments are not supported.',
          jsxNode
        )
      }

      const handler = COMPONENT_HANDLERS[componentName]
      if (!handler) {
        throw parserError(
          ParserErrorCode.UNSUPPORTED_COMPONENT,
          `Unsupported JSX component "${componentName}".`,
          jsxNode,
          { component: componentName }
        )
      }

      const result = await handler(jsxNode, ctx)
      blocks.push(...result)
    }
    // Bare expressions like {someVar} or {() => fn()} are not allowed.
    if (
      node.type === 'mdxFlowExpression' ||
      node.type === 'mdxTextExpression'
    ) {
      const expr = node as { value?: string; position?: Root['position'] }
      throw parserError(
        ParserErrorCode.DYNAMIC_EXPRESSION,
        `Top-level expression "{${expr.value ?? '...'}}" is not supported.`,
        node
      )
    }

    // ESM import/export statements are not allowed — MDX content in this
    // pipeline is converted to Strapi blocks, not executed as JS modules.
    if (node.type === 'mdxjsEsm') {
      const esm = node as { value?: string; position?: Root['position'] }
      throw parserError(
        ParserErrorCode.DYNAMIC_EXPRESSION,
        `Import/export statements are not supported: "${esm.value ?? '...'}"`,
        node
      )
    }

    // Markdown nodes (paragraph, heading, etc.) are handled by the
    // Paragraph handler once registered. Until then, they pass through
    // unmatched — the caller (buildPagePayload) only invokes the parser
    // when JSX components are present in the body.
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
