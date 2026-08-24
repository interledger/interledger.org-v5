import type { Element, Root, Text } from 'hast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { visit } from 'unist-util-visit'
import {
  buildUmamiAttrs,
  extractTitleLabel,
  DEFAULT_INLINE_LINK_BASE_COMPONENT
} from './umami'
import { LOCALE_CODES } from './localeCodes'

/**
 * Adds umami event attributes to every `<a>` rendered from Markdown/MDX.
 *
 * `current_path` is derived from the source file's locale-aware path (or
 * `frontmatter.umamiContext` if set). Every link emits the flat `link` label
 * with `inline_link` as its `base_component`, unless authors supply a
 * `label:foo` markdown link title to override the base_component. Starlight
 * `docs` content is skipped.
 */

const CONTENT_FILE_RE = /\/src\/content\/([^/]+)\/(.+)\.(?:mdx?|md)$/
const localeSet = new Set<string>(LOCALE_CODES)

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
    slugSegments.length > 0 && localeSet.has(slugSegments[0].toLowerCase())
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
    const { label: baseComponentOverride, title: cleanedTitle } =
      extractTitleLabel(rawTitle)
    if (baseComponentOverride) {
      delete props.title
    } else if (cleanedTitle !== undefined) {
      props.title = cleanedTitle
    }

    const attrs = buildUmamiAttrs({
      currentPath: overridePage,
      pathname,
      lang,
      label: 'link',
      baseComponent:
        baseComponentOverride || DEFAULT_INLINE_LINK_BASE_COMPONENT,
      linkText: text.trim(),
      href: typeof props.href === 'string' ? props.href : undefined
    })

    for (const [key, value] of Object.entries(attrs)) {
      props[key] = value as string
    }
  })
}

export default rehypeUmamiLinks
