import { parse } from 'node-html-parser'

export const TABLE_SCROLL_CLASS = 'table-scroll'

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/**
 * Wraps each `<table>` in a focusable scroll region for keyboard users (WCAG 2.1.1).
 */
export function wrapScrollableTables(
  html: string,
  ariaLabel: string
): string {
  if (!html.includes('<table')) return html

  const root = parse(`<div data-wrap-root>${html}</div>`, {
    lowerCaseTagName: false
  })
  const tables = root.querySelectorAll('table')
  if (tables.length === 0) return html

  for (const table of tables) {
    const wrapper = parse(
      `<div class="${TABLE_SCROLL_CLASS}" role="region" aria-label="${escapeAttr(ariaLabel)}" tabindex="0" data-lenis-prevent></div>`,
      { lowerCaseTagName: false }
    ).querySelector('div')
    if (!wrapper) continue

    table.replaceWith(wrapper)
    wrapper.appendChild(table)
  }

  return root.querySelector('[data-wrap-root]')?.innerHTML ?? html
}
