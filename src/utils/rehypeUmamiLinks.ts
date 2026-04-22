import type { Element, Root, Text } from 'hast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { visit } from 'unist-util-visit'
import { buildUmamiEvent, resolvePageLabel } from './umami'

/**
 * Adds `data-umami-event` to every `<a>` rendered from Markdown/MDX.
 * The page label comes from `frontmatter.umamiContext` when set, otherwise
 * from the source file path (e.g. `foundation-pages/about-us.mdx`
 * → "About Us page"). Starlight `docs` content is skipped.
 */

const CONTENT_FILE_RE = /\/src\/content\/([^/]+)\/(.+)\.(?:mdx?|md)$/

interface AstroFileData {
  astro?: { frontmatter?: Record<string, unknown> }
}

const rehypeUmamiLinks: Plugin<[], Root> = () => (tree, file: VFile) => {
  const filePath = file.path || file.history?.at(-1)
  if (!filePath) return

  const match = filePath.replace(/\\/g, '/').match(CONTENT_FILE_RE)
  if (!match) return
  const [, collection, slug] = match
  if (collection === 'docs') return

  const frontmatter = (file.data as AstroFileData)?.astro?.frontmatter ?? {}
  const override =
    typeof frontmatter.umamiContext === 'string'
      ? frontmatter.umamiContext
      : undefined

  const pageLabel = resolvePageLabel({
    pageLabel: override,
    pathname: `/${slug.replace(/\/index$/, '')}`
  })

  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'a') return
    const props = (node.properties ??= {})
    if (
      typeof props.dataUmamiEvent === 'string' ||
      typeof props['data-umami-event'] === 'string'
    ) {
      return
    }
    let text = ''
    visit(node, 'text', (t: Text) => {
      text += t.value
    })
    props.dataUmamiEvent = buildUmamiEvent({
      pageLabel,
      linkText: text.trim(),
      href: typeof props.href === 'string' ? props.href : undefined
    })
  })
}

export default rehypeUmamiLinks
