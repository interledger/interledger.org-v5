/**
 * Exclusive FAQ questions: opening one closes the others in the same
 * accordion, then scrolls the opened question under the site header.
 *
 * Native `<details name>` does the exclusive grouping without JS, but it
 * cannot animate closed — the UA hides the body the instant `open` is
 * cleared. Click on summary is preventDefault'd so we keep `open` true
 * while `[data-faq-panel]` slides 0fr ↔ 1fr, then clear `open` after.
 *
 * Each accordion instance must use its own `name` (see
 * `faqAccordionGroupName`). A shared `name="faq"` is document-wide, so
 * two FAQs on one page would close each other before JS runs.
 *
 * `name` is removed once JS is ready so setting `.open` on the clicked
 * item does not snap-close siblings (the HTML name grouping would).
 */

const ACCORDION_SELECTOR = '[data-faq-accordion]'
const ITEM_SELECTOR = '[data-faq-item]'

/** Unique `<details name>` so exclusive grouping stays inside one accordion. */
export function faqAccordionGroupName(): string {
  return `faq-${crypto.randomUUID()}`
}

const PANEL_SELECTOR = '[data-faq-panel]'
const SLIDE_MS = 200

type SiteLenis = {
  scrollTo: (target: number, options: { immediate: boolean }) => void
}

const closeTimeouts = new WeakMap<
  HTMLDetailsElement,
  ReturnType<typeof setTimeout>
>()
const closeListeners = new WeakMap<HTMLDetailsElement, EventListener>()

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function panelOf(item: HTMLDetailsElement): HTMLElement | null {
  return item.querySelector(PANEL_SELECTOR)
}

function isExpanded(item: HTMLDetailsElement): boolean {
  return item.dataset.faqExpanded === 'true'
}

function siteLenis(): SiteLenis | undefined {
  return (globalThis as unknown as { __siteLenis?: SiteLenis }).__siteLenis
}

/** Document Y that puts the question top just under the header. */
export function questionScrollDestination(item: HTMLElement): number {
  const margin = parseFloat(getComputedStyle(item).scrollMarginTop)
  const headerGap = Number.isFinite(margin) ? margin : 0
  return globalThis.scrollY + item.getBoundingClientRect().top - headerGap
}

function applyScroll(y: number): void {
  const lenis = siteLenis()
  if (lenis) {
    lenis.scrollTo(y, { immediate: true })
    return
  }
  globalThis.scrollTo({ top: y, behavior: 'instant' })
}

function isLastAccordionItem(item: HTMLElement): boolean {
  const root = item.closest(ACCORDION_SELECTOR)
  if (!root) return false
  const items = root.querySelectorAll(ITEM_SELECTOR)
  return items.length > 0 && items[items.length - 1] === item
}

export function scrollQuestionIntoView(item: HTMLElement): void {
  // Snapping the last question under the header bottoms the page and
  // drags a sticky sibling (FAQ section nav) with it. Leave it in place.
  if (isLastAccordionItem(item)) return
  if (prefersReducedMotion()) {
    item.scrollIntoView({ block: 'start' })
    return
  }
  applyScroll(questionScrollDestination(item))
}

function cancelPendingClose(item: HTMLDetailsElement): void {
  const timeoutId = closeTimeouts.get(item)
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId)
    closeTimeouts.delete(item)
  }
  const listener = closeListeners.get(item)
  if (!listener) return
  panelOf(item)?.removeEventListener('transitionend', listener)
  closeListeners.delete(item)
}

export function openFaqPanel(item: HTMLDetailsElement): void {
  cancelPendingClose(item)
  item.dataset.faqExpanded = 'true'
  item.open = true
  const panel = panelOf(item)
  if (!panel) return
  if (prefersReducedMotion()) {
    panel.dataset.open = 'true'
    return
  }
  delete panel.dataset.open
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (item.dataset.faqExpanded !== 'true') return
      panel.dataset.open = 'true'
    })
  })
}

/**
 * Collapse without the 200ms grid-rows transition so a sibling close can
 * be compensated with an instant scroll in the same turn.
 */
function snapPanelClosed(panel: HTMLElement): void {
  const previous = panel.style.transition
  panel.style.transition = 'none'
  delete panel.dataset.open
  void panel.offsetHeight
  panel.style.transition = previous
}

export function closeFaqPanel(
  item: HTMLDetailsElement,
  options?: { instant?: boolean }
): void {
  item.dataset.faqExpanded = 'false'
  const panel = panelOf(item)
  if (!panel || prefersReducedMotion() || options?.instant) {
    cancelPendingClose(item)
    if (panel) {
      if (options?.instant) snapPanelClosed(panel)
      else delete panel.dataset.open
    }
    item.open = false
    return
  }
  cancelPendingClose(item)
  delete panel.dataset.open

  const finish = (event?: TransitionEvent) => {
    if (event && event.target !== panel) return
    if (event?.propertyName && event.propertyName !== 'grid-template-rows') {
      return
    }
    cancelPendingClose(item)
    if (item.dataset.faqExpanded === 'true') return
    item.open = false
  }
  const onTransitionEnd = (event: Event) => finish(event as TransitionEvent)
  closeListeners.set(item, onTransitionEnd)
  panel.addEventListener('transitionend', onTransitionEnd)
  closeTimeouts.set(
    item,
    setTimeout(() => finish(), SLIDE_MS + 50)
  )
}

export function handleFaqItemClick(
  item: HTMLDetailsElement,
  items: Iterable<HTMLDetailsElement>
): void {
  if (isExpanded(item)) {
    closeFaqPanel(item)
    return
  }

  for (const other of items) {
    if (other !== item && isExpanded(other)) {
      closeFaqPanel(other, { instant: true })
    }
  }
  openFaqPanel(item)
  scrollQuestionIntoView(item)
}

export function initFaqAccordion(root: ParentNode = document): void {
  root
    .querySelectorAll<HTMLElement>(ACCORDION_SELECTOR)
    .forEach((accordion) => {
      if (accordion.dataset.faqAccordionReady === 'true') return
      accordion.dataset.faqAccordionReady = 'true'

      const items = () =>
        Array.from(
          accordion.querySelectorAll<HTMLDetailsElement>(ITEM_SELECTOR)
        )

      items().forEach((item) => {
        item.removeAttribute('name')
        const panel = panelOf(item)
        if (item.open) {
          item.dataset.faqExpanded = 'true'
          if (panel) panel.dataset.open = 'true'
        }
        const summary = item.querySelector('summary')
        summary?.addEventListener('click', (event) => {
          event.preventDefault()
          handleFaqItemClick(item, items())
        })
      })
    })
}
