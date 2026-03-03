/**
 * MDX Block Parser — top-level AST walker.
 *
 * Parses an MDX body string into an ordered array of Strapi blocks.
 * Markdown text between JSX components becomes `blocks.paragraph` entries;
 * recognised JSX components are dispatched to their block parsers;
 * unrecognised components trigger a hard error (strict mode).
 *
 * This module also exports `resolveBlockRelations` which replaces
 * slug strings with Strapi document IDs.
 */

import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx'
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import type { RootContent } from 'mdast'
import { BLOCK_PARSERS, type StrapiBlock } from './blockParsers'
import type { StrapiClient } from './strapiClient'

// ---------------------------------------------------------------------------
// Heading look-ahead for container blocks
// ---------------------------------------------------------------------------

/**
 * Container blocks (CardsGrid, CardLinksGrid, Carousel) may be preceded by
 * a markdown ## heading and/or a plain paragraph that the serializer emitted
 * as the `heading` / `subheading` fields.  When we see one of these containers,
 * we retroactively pull the preceding heading/subheading out of the accumulated
 * markdown paragraph buffer and attach them to the block.
 */
const CONTAINER_COMPONENTS = new Set(['CardsGrid', 'CardLinksGrid', 'Carousel'])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an MDX body (the content after frontmatter) into Strapi blocks.
 *
 * @param mdxBody - the MDX content string (without frontmatter)
 * @returns ordered array of Strapi block objects
 */
export function parseMdxToBlocks(mdxBody: string): StrapiBlock[] {
  const tree = remark().use(remarkMdx).parse(mdxBody)

  const blocks: StrapiBlock[] = []
  // Buffer for consecutive markdown nodes that will become a paragraph block
  let mdNodes: RootContent[] = []

  function flushMarkdown(): void {
    if (mdNodes.length === 0) return
    const md = toMarkdown(
      { type: 'root', children: mdNodes as RootContent[] },
      { extensions: [mdxJsxToMarkdown()] }
    ).trim()
    if (md.length > 0) {
      blocks.push({ __component: 'blocks.paragraph', content: md })
    }
    mdNodes = []
  }

  /**
   * For container blocks, pull heading/subheading from the last paragraph
   * block we flushed.  The serializers emit:
   *   ## Heading\n\nSubheading\n\n<CardsGrid ...>
   * So we may need to split the preceding paragraph to extract those.
   */
  function attachHeadingToContainer(block: StrapiBlock): void {
    if (blocks.length === 0) return
    const prev = blocks[blocks.length - 1]
    if (prev.__component !== 'blocks.paragraph') return

    const content = (prev.content as string).trimEnd()

    // Try to find a ## heading in the content.
    // The serializer emits: ## Heading\n\nSubheading\n\n<Container>
    // The heading may be the entire block, or it may follow other content.
    const headingMatch = content.match(/(?:^|\n\n)(## .+)$/s)
    if (!headingMatch) return

    const headingSection = headingMatch[1].trim()
    const beforeHeading = content
      .slice(0, content.length - headingMatch[0].length)
      .trim()

    const headingLines = headingSection.split('\n')
    let heading: string | undefined
    let subheading: string | undefined

    if (headingLines[0].startsWith('## ')) {
      heading = headingLines[0].replace(/^## /, '').trim()
      const rest = headingLines.slice(1).join('\n').trim()
      if (rest) {
        subheading = rest
      }
    }

    // Remove the old paragraph and potentially re-add content before the heading
    blocks.pop()
    if (beforeHeading) {
      blocks.push({
        __component: 'blocks.paragraph',
        content: beforeHeading
      })
    }

    if (heading !== undefined) {
      block.heading = heading
    }
    if (subheading !== undefined) {
      block.subheading = subheading
    }
  }

  for (const node of tree.children) {
    if (node.type === 'mdxJsxFlowElement') {
      const jsxNode = node as MdxJsxFlowElement
      const componentName = jsxNode.name

      if (!componentName) {
        throw new Error(
          `Unnamed JSX element found at line ${jsxNode.position?.start.line ?? '?'} — fragments are not supported`
        )
      }

      const parser = BLOCK_PARSERS[componentName]
      if (!parser) {
        throw new Error(
          `Unrecognised JSX component <${componentName}> at line ${jsxNode.position?.start.line ?? '?'}. ` +
            `Known components: ${Object.keys(BLOCK_PARSERS).join(', ')}`
        )
      }

      // Flush any accumulated markdown before the JSX block
      flushMarkdown()

      const block = parser(jsxNode)

      // Attach preceding heading for container blocks
      if (CONTAINER_COMPONENTS.has(componentName)) {
        attachHeadingToContainer(block)
      }

      blocks.push(block)
    } else {
      // Markdown node — accumulate for later flushing as blocks.paragraph
      mdNodes.push(node)
    }
  }

  // Flush any trailing markdown
  flushMarkdown()

  return blocks
}

// ---------------------------------------------------------------------------
// Relation resolution
// ---------------------------------------------------------------------------

/**
 * Resolve slug strings to Strapi document IDs in block payloads.
 *
 * This walks the block array and for blocks that reference ambassadors
 * (by slug), replaces the slug with the Strapi document ID.
 *
 * @param blocks - array of Strapi blocks (from parseMdxToBlocks)
 * @param strapi - Strapi REST client
 * @returns blocks with relations resolved to document IDs
 */
export async function resolveBlockRelations(
  blocks: StrapiBlock[],
  strapi: StrapiClient
): Promise<StrapiBlock[]> {
  const resolved = []

  for (const block of blocks) {
    if (block.__component === 'blocks.ambassador') {
      const slug = block.ambassador as string
      const entry = await strapi.findBySlug('ambassadors', slug)
      if (!entry) {
        throw new Error(
          `Ambassador slug "${slug}" not found in Strapi — cannot resolve relation`
        )
      }
      resolved.push({
        ...block,
        ambassador: entry.documentId
      })
    } else if (block.__component === 'blocks.ambassadors-grid') {
      const slugs = block.ambassadors as string[]
      const ids: string[] = []
      for (const slug of slugs) {
        const entry = await strapi.findBySlug('ambassadors', slug)
        if (!entry) {
          throw new Error(
            `Ambassador slug "${slug}" not found in Strapi — cannot resolve relation`
          )
        }
        ids.push(entry.documentId)
      }
      resolved.push({
        ...block,
        ambassadors: ids
      })
    } else {
      resolved.push(block)
    }
  }

  return resolved
}
