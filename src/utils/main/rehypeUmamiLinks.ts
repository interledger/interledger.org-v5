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
import { getNewTabLinkAttrs, getOpensNewTabLabel } from './newTabLinks'

/**
 * Adds umami event attributes to every `<a>` rendered from Markdown/MDX, and
 * opens off-site links in a new tab (see `getNewTabLinkAttrs`).
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

  const umamiCtx: LinkUmamiContext = {
    currentPath: overridePage,
    pathname,
    lang
  }

  const headingLinks = collectHeadingLinks(tree)

  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'a') return
    addUmamiAttrs(node, umamiCtx)
    // After the umami pass, so the hint stays out of `link-text`.
    addNewTabAttrs(node, lang, {
      warnVia: headingLinks.has(node) ? 'aria-label' : 'span'
    })
  })
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/**
 * Links inside headings. MDX slugs heading ids from their text after this
 * plugin runs, so a hint span there would leak into the id and break
 * `#anchors`. These links carry the warning in `aria-label` instead.
 */
function collectHeadingLinks(tree: Root): Set<Element> {
  const links = new Set<Element>()
  visit(tree, 'element', (heading: Element) => {
    if (!HEADING_TAGS.has(heading.tagName)) return
    visit(heading, 'element', (node: Element) => {
      if (node.tagName === 'a') links.add(node)
    })
  })
  return links
}

interface LinkUmamiContext {
  currentPath?: string
  pathname: string
  lang: string
}

function addUmamiAttrs(node: Element, ctx: LinkUmamiContext): void {
  const props = (node.properties ??= {})
  if (
    typeof props.dataUmamiEvent === 'string' ||
    typeof props['data-umami-event'] === 'string'
  ) {
    return
  }
  const text = getTextContent(node)

  const rawTitle = typeof props.title === 'string' ? props.title : undefined
  const { label: baseComponentOverride, title: cleanedTitle } =
    extractTitleLabel(rawTitle)
  if (baseComponentOverride) {
    delete props.title
  } else if (cleanedTitle !== undefined) {
    props.title = cleanedTitle
  }

  const attrs = buildUmamiAttrs({
    ...ctx,
    label: 'link',
    baseComponent: baseComponentOverride || DEFAULT_INLINE_LINK_BASE_COMPONENT,
    linkText: text,
    href: typeof props.href === 'string' ? props.href : undefined
  })

  for (const [key, value] of Object.entries(attrs)) {
    props[key] = value as string
  }
}

function getTextContent(node: Element): string {
  let text = ''
  visit(node, 'text', (t: Text) => {
    text += t.value
  })
  return text.trim()
}

/** Where a new-tab link carries its "opens in a new tab" warning. */
type NewTabWarning = 'span' | 'aria-label'

/**
 * Opens off-site links in a new tab and warns screen-reader users, by
 * default with a visually hidden span. A `target` already set by the author
 * wins, so a raw JSX `<a>` keeps its choice.
 */
function addNewTabAttrs(
  node: Element,
  lang: string,
  { warnVia }: { warnVia: NewTabWarning }
): void {
  const props = (node.properties ??= {})
  if (props.target !== undefined) return

  const attrs = getNewTabLinkAttrs(
    typeof props.href === 'string' ? props.href : undefined
  )
  if (!('target' in attrs)) return

  props.target = attrs.target
  props.rel = attrs.rel
  const warning = getOpensNewTabLabel(lang)
  // An authored aria-label replaces the link's content as its name, so a
  // hint span would never be read.
  if (warnVia === 'aria-label' || typeof props.ariaLabel === 'string') {
    addAriaLabelWarning(node, warning)
    return
  }
  node.children.push({
    type: 'element',
    tagName: 'span',
    properties: { className: ['sr-only'] },
    children: [{ type: 'text', value: ` ${warning}` }]
  })
}

/**
 * Appends the warning to the link's accessible name. A link with no text and
 * no label (an image-only link) is left alone: an `aria-label` would replace
 * the image's alt text as its name.
 */
function addAriaLabelWarning(node: Element, warning: string): void {
  const props = (node.properties ??= {})
  const existing =
    typeof props.ariaLabel === 'string' ? props.ariaLabel.trim() : ''
  const name = existing || getTextContent(node)
  if (!name) return
  props.ariaLabel = `${name} ${warning}`
}

export default rehypeUmamiLinks
