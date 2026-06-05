import type { Element, Parents, Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { getTableScrollAriaLabel } from './getTableScrollAriaLabel'
import { TABLE_SCROLL_CLASS } from './wrapScrollableTables'

const CONTENT_FILE_RE = /\/src\/content\/([^/]+)\/(.+)\.(?:mdx?|md)$/
const LOCALE_CODES = new Set(['en', 'es'])

function isTableParent(parent: Parents | null | undefined): parent is Parents {
  if (!parent || !('children' in parent)) return false
  return (
    parent.type === 'root' ||
    parent.type === 'element' ||
    parent.type === 'mdxJsxFlowElement'
  )
}

function createTableScrollWrapper(
  table: Element,
  ariaLabel: string
): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: [TABLE_SCROLL_CLASS],
      role: 'region',
      ariaLabel,
      tabIndex: 0,
      dataLenisPrevent: ''
    },
    children: [table]
  }
}

/**
 * Wraps markdown/MDX tables in a focusable horizontal scroll region.
 * Skips Starlight docs content.
 */
const rehypeWrapScrollableTables: Plugin<[], Root> = () => (tree, file) => {
  const filePath = file.path || file.history?.at(-1)
  if (!filePath) return

  const match = filePath.replace(/\\/g, '/').match(CONTENT_FILE_RE)
  if (!match) return
  const [collection] = match.slice(1)
  if (collection === 'docs') return

  const slugSegments = match[2].replace(/\/index$/, '').split('/').filter(Boolean)
  const locale =
    slugSegments[0] && LOCALE_CODES.has(slugSegments[0])
      ? slugSegments[0]
      : undefined

  const ariaLabel = getTableScrollAriaLabel(locale)
  const wrappers: { index: number; parent: Parents; wrapper: Element }[] = []

  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'table' || index == null || !isTableParent(parent)) {
      return
    }

    wrappers.push({
      index,
      parent,
      wrapper: createTableScrollWrapper(node, ariaLabel)
    })
  })

  for (const { index, parent, wrapper } of wrappers) {
    parent.children[index] = wrapper
  }
}

export default rehypeWrapScrollableTables
