/**
 * Closes a filter dropdown on Escape, on focus leaving the control, and on
 * a pointer press outside it.
 *
 * Focusout also fires when moving from the summary to an option inside the
 * panel. That move stays inside the `<details>`, so it must not close.
 * Escape returns focus to the summary: closing the panel can otherwise drop
 * a keyboard user on the page body.
 *
 * Bound once per element. `FilterDropdown.astro` calls `initFilterDropdowns`
 * for every `[data-filter-dropdown]` on the page.
 */

export function bindFilterDropdown(details: HTMLDetailsElement): void {
  if (details.dataset.filterDropdownBound === 'true') return
  details.dataset.filterDropdownBound = 'true'

  const summary = details.querySelector<HTMLElement>('summary')

  details.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && details.open) {
      details.open = false
      summary?.focus()
    }
  })

  details.addEventListener('focusout', (event: FocusEvent) => {
    if (!details.contains(event.relatedTarget as Node)) {
      details.open = false
    }
  })

  document.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!details.open) return
    // `target` is an EventTarget. `contains` only accepts a Node.
    if (event.target instanceof Node && !details.contains(event.target)) {
      details.open = false
    }
  })
}

export function initFilterDropdowns(root: ParentNode = document): void {
  root
    .querySelectorAll<HTMLDetailsElement>('[data-filter-dropdown]')
    .forEach(bindFilterDropdown)
}
