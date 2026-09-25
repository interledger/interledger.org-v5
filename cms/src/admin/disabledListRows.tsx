/**
 * Marks switched-off entries in the Content Manager list view.
 *
 * A content type opts in from its schema with
 *   "pluginOptions": { "listView": { "disabledFlag": "<boolean attribute>" } }
 * and every row whose flag is `false` gets a "Disabled" badge in a leading
 * Status column plus a muted row (see DISABLED_ROW_CSS). Strapi merges
 * `pluginOptions` into the list layout's `options`, which is the only place the
 * list-view hook can tell which content type it is rendering.
 *
 * Strapi exposes no row-level styling, so the badge doubles as the row's
 * marker: DISABLED_ROW_CSS finds its <tr> with `:has()`.
 */

import React from 'react'

/** The hook the Content Manager runs over its list-view table headers. */
export const INJECT_COLUMN_IN_TABLE_HOOK =
  'Admin/CM/pages/ListView/inject-column-in-table'

const STATUS_CLASS = 'cm-list-status'
const STATUS_COLUMN_NAME = 'listViewStatus'

/** A list-view header; only the fields this hook reads or writes are typed. */
interface ListViewHeader {
  name: string
  [key: string]: unknown
}

interface ListViewHookArgs {
  displayedHeaders: ListViewHeader[]
  layout: { options?: Record<string, unknown> }
}

function readDisabledFlag(
  options: Record<string, unknown> | undefined
): string | undefined {
  const listView = options?.listView
  if (typeof listView !== 'object' || listView === null) return undefined
  const flag = (listView as { disabledFlag?: unknown }).disabledFlag
  return typeof flag === 'string' && flag !== '' ? flag : undefined
}

function StatusCell({ disabled }: { disabled: boolean }) {
  return (
    <span
      className={STATUS_CLASS}
      data-state={disabled ? 'disabled' : 'enabled'}
    >
      {disabled ? 'Disabled' : 'Enabled'}
    </span>
  )
}

function statusHeader(flag: string) {
  return {
    attribute: { type: 'custom' },
    name: STATUS_COLUMN_NAME,
    label: {
      id: 'content-manager.list-view.status',
      defaultMessage: 'Status'
    },
    searchable: false,
    sortable: false,
    // A row stored before the flag existed holds null, which counts as on.
    cellFormatter: (row: Record<string, unknown>) => (
      <StatusCell disabled={row[flag] === false} />
    )
  }
}

/**
 * Leads the table with a Status column for opted-in content types, replacing
 * the raw true/false column for the flag if the editor had it displayed.
 */
export function markDisabledListRows({
  displayedHeaders,
  layout
}: ListViewHookArgs): ListViewHookArgs {
  const flag = readDisabledFlag(layout.options)
  if (!flag) return { displayedHeaders, layout }
  return {
    displayedHeaders: [
      statusHeader(flag),
      ...displayedHeaders.filter((header) => header.name !== flag)
    ],
    layout
  }
}

/**
 * Colours come from `currentColor` and translucent tints so the badge and the
 * muted row read correctly in both the light and dark admin themes. The
 * checkbox and actions cells stay at full strength: they are still usable.
 */
export const DISABLED_ROW_CSS = `
  .${STATUS_CLASS} {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.6;
    white-space: nowrap;
  }
  .${STATUS_CLASS}[data-state='enabled'] {
    border-color: transparent;
    background: rgba(50, 128, 72, 0.14);
  }
  tr:has(.${STATUS_CLASS}[data-state='disabled']) > td {
    background: rgba(128, 128, 128, 0.12);
  }
  tr:has(.${STATUS_CLASS}[data-state='disabled'])
    > td:not(:first-child):not(:last-child)
    > *:not(.${STATUS_CLASS}) {
    opacity: 0.7;
    text-decoration: line-through;
  }
`
