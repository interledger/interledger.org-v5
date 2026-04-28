import type { Element, Root, Text } from 'hast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { visit } from 'unist-util-visit'
import { buildUmamiAttrs, extractTitleLabel } from './umami'

/**
 * Adds umami event attributes to every `<a>` rendered from Markdown/MDX.
 *
 * Page is derived from the source file's locale-aware path (or
 * `frontmatter.umamiContext` if set). Section is always `link` for
 * authored content. Authors can supply a `label:foo` markdown link title
 * to override the action segment (`{page}:link` + `data-umami-event-label`).
 * Starlight `docs` content is skipped.
 */

const CONTENT_FILE_RE = /\/src\/content\/([^/]+)\/(.+)\.(?:mdx?|md)$/
const LOCALE_CODES = new Set(['en', 'es'])

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
  const overridePage =
    typeof frontmatter.umamiContext === 'string'
      ? frontmatter.umamiContext
      : undefined

  const cleanedSlug = slug.replace(/\/index$/, '')
  const slugSegments = cleanedSlug.split('/').filter(Boolean)
  const lang =
    slugSegments.length > 0 && LOCALE_CODES.has(slugSegments[0].toLowerCase())
      ? slugSegments[0].toLowerCase()
      : 'en'
  const pathname = `/${cleanedSlug}`

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

    const rawTitle = typeof props.title === 'string' ? props.title : undefined
    const { label, title: cleanedTitle } = extractTitleLabel(rawTitle)
    if (label) {
      delete props.title
    } else if (cleanedTitle !== undefined) {
      props.title = cleanedTitle
    }

    const attrs = buildUmamiAttrs({
      page: overridePage,
      pathname,
      lang,
      section: 'link',
      linkText: text.trim(),
      href: typeof props.href === 'string' ? props.href : undefined,
      label
    })

    for (const [key, value] of Object.entries(attrs)) {
      props[key] = value as string
    }
  })
}

export default rehypeUmamiLinks
