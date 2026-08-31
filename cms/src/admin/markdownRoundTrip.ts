/**
 * Line-break handling for the CKEditor markdown round trip.
 *
 * The editor stores GFM, so every transform here runs on the HTML the editor
 * hands to its markdown converter, or on the markdown that comes back out.
 * `app.tsx` wires them into the data processor.
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Nodes } from 'mdast'

// Unassigned Unicode private-use code point: it cannot collide with authored
// text, and no markdown rule escapes or reflows it.
export const SOFT_BREAK_PLACEHOLDER = '\uE000'

/**
 * Prepares editor HTML for the markdown converter.
 */
export function prepareHtmlForMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  mergeMultiParagraphTableCells(doc)
  replaceSoftBreaksWithPlaceholder(doc)
  return doc.body.innerHTML
}

/** Writes the placeholders back out as real line breaks. */
export function restoreSoftBreaks(markdown: string): string {
  return markdown.replaceAll(SOFT_BREAK_PLACEHOLDER, '<br />')
}

/**
 * A Shift+Enter soft break has to survive the markdown round trip as a literal
 * `<br />`: GFM has no hard-break syntax valid inside a table cell, and Astro
 * runs no remark-breaks, so a bare `\n` renders as nothing.
 *
 * The converter's own `keepHtml('br')` produces that literal, but it emits an
 * mdast `html` node, and `html` counts as flow content rather than phrasing.
 * Wherever the break is not already inside a `<p>` — a plain list item,
 * chiefly — that splits the block in two and strands the `<br>` on a line of
 * its own (INTORG-1182).
 *
 * A placeholder is a text node instead, so it is phrasing content everywhere
 * and the break stays inside its own block. Breaks inside `<pre>`/`<code>`
 * keep the converter's default treatment: those already become real newlines,
 * which is what a code block wants.
 */
function replaceSoftBreaksWithPlaceholder(doc: Document) {
  for (const lineBreak of doc.querySelectorAll('br')) {
    if (lineBreak.closest('pre, code')) continue
    lineBreak.replaceWith(doc.createTextNode(SOFT_BREAK_PLACEHOLDER))
  }
}

// The stranded shape content saved before the placeholder swap still carries:
// the list item's text, then a line holding nothing but the <br>, then the rest
// of the text as a second paragraph. Both blank-line counts appear in the wild
// — CKEditor wrote one, prettier reformatted the MDX with two.
const STRANDED_LIST_ITEM_BREAK =
  /(\S)[^\S\n]*\n\n?[ \t]+<br\s*\/?>[^\S\n]*\n\n[ \t]+(?=\S)/g

/**
 * Pulls a stranded `<br>` back onto the end of the previous line, so the list
 * item loads as one paragraph again and the next save writes the inline form.
 *
 * The rejoined text stays on that one line. CKEditor's markdown parser reads a
 * soft wrap as another line break, so leaving the wrap in place would show the
 * author two breaks where they typed one.
 *
 * A `<br>` with no text after it inside the item is left alone: an author put
 * it there as trailing space, and there is no paragraph to rejoin it to.
 */
export function healStrandedListItemBreaks(markdown: string): string {
  return markdown.replace(STRANDED_LIST_ITEM_BREAK, '$1<br />')
}

/**
 * GFM table cells only hold inline content, so a second `<p>` in one `<td>`
 * (e.g. pasted multi-line content) flattens with no separator. Merge sibling
 * paragraphs into one, separated by line breaks.
 */
function mergeMultiParagraphTableCells(doc: Document) {
  const cells = doc.querySelectorAll('td, th')

  for (const cell of cells) {
    const paragraphs = Array.from(cell.children).filter(
      (el): el is HTMLParagraphElement => el.tagName === 'P'
    )
    if (paragraphs.length < 2) continue

    // Two <br> per boundary, not one: a boundary here is hard Enter (a real
    // paragraph break), which should read as a bigger visual gap than
    // Shift+Enter's single <br> soft break — the closest a table cell can
    // get to an actual paragraph break, since GFM can't represent one.
    const merged = doc.createElement('p')
    paragraphs.forEach((p, i) => {
      if (i > 0) {
        merged.appendChild(doc.createElement('br'))
        merged.appendChild(doc.createElement('br'))
      }
      while (p.firstChild) merged.appendChild(p.firstChild)
    })
    cell.replaceChild(merged, paragraphs[0])
    paragraphs.slice(1).forEach((p) => cell.removeChild(p))
  }
}

const markdownParser = unified().use(remarkParse).use(remarkGfm)

/**
 * Rewrites a soft line wrap as the space it means, before the editor's parser
 * sees it.
 *
 * That parser reads every newline inside a paragraph as a hard line break, so
 * text stored with wrapped lines gains a real `<br />` at each wrap point on
 * the next save — breaks nobody typed, in content nobody edited. Astro renders
 * a soft wrap as a space, so the wrap has to reach the editor as one.
 *
 * Only the newlines inside a `text` node are touched. A markdown hard break
 * (two trailing spaces, or a backslash) parses as its own `break` node, code
 * and raw HTML as their own node types, so all of those keep their newlines.
 * The continuation line's block prefix goes with the newline: its indentation,
 * and the marker of any blockquote the text sits in.
 *
 * On a parse failure the markdown is handed back untouched. A break that
 * should not be there beats an editor that will not open.
 */
export function collapseSoftWraps(markdown: string): string {
  if (!markdown.includes('\n')) return markdown

  let tree: Nodes
  try {
    tree = markdownParser.parse(markdown)
  } catch (err) {
    console.error('[CKEditor] could not parse markdown to find soft wraps', err)
    return markdown
  }

  const wraps = findSoftWraps(tree, markdown)
  if (!wraps.length) return markdown

  let out = ''
  let cursor = 0
  for (const [from, to] of wraps) {
    out += markdown.slice(cursor, from) + ' '
    cursor = to
  }
  return out + markdown.slice(cursor)
}

/** Source ranges to replace with a space, in order, as `[from, to)` pairs. */
function findSoftWraps(tree: Nodes, markdown: string): Array<[number, number]> {
  const wraps: Array<[number, number]> = []

  function walk(node: Nodes) {
    if ('children' in node) {
      for (const child of node.children) walk(child as Nodes)
      return
    }
    if (node.type !== 'text' || !node.value.includes('\n')) return

    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) return

    for (let i = start; i < end; i++) {
      if (markdown[i] !== '\n') continue
      const from = markdown[i - 1] === '\r' ? i - 1 : i
      let to = i + 1
      while (to < end && ' \t>'.includes(markdown[to])) to++
      wraps.push([from, to])
    }
  }

  walk(tree)
  return wraps
}
