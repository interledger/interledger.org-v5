import showdown from 'showdown'
import { wrapScrollableTables } from '../shared/wrapScrollableTables'
import { rewriteRfcLinks } from './rewriteRfcLinks'

const FRONT_MATTER_FENCE = '---'

/**
 * Accessible name of an RFC table's scroll region. The docs are English-only,
 * and the docs lane can't import the main site's `ui` strings, so this
 * repeats the English `prose.table_scroll_region` text.
 */
const TABLE_SCROLL_LABEL = 'Scrollable table'

/**
 * Turn an RFC's raw GitHub Markdown into the HTML a docs page shows.
 *
 * Tables get a focusable scroll region. The docs design system sets tables to
 * `display: table`, which turns off Starlight's own table scrolling, so
 * without the wrapper a wide table widens the whole page on mobile.
 */
export function renderRfcMarkdown(
  markdown: string,
  options: { sourceUrl: string; docsBasePath: string }
): string {
  const frontMatterEnd =
    markdown.indexOf(FRONT_MATTER_FENCE, 1) + FRONT_MATTER_FENCE.length
  const specBody = markdown.slice(frontMatterEnd)

  const converter = new showdown.Converter({
    tables: true,
    ghCompatibleHeaderId: true
  })
  const html = rewriteRfcLinks(converter.makeHtml(specBody), options)
  return wrapScrollableTables(html, TABLE_SCROLL_LABEL)
}
