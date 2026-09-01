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
/** Programmatic scroll to the opened question — slower than native smooth. */
const FAQ_SCROLL_DURATION_MS = 1400

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

let scrollFrame = 0

function cancelQuestionScroll(): void {
  if (!scrollFrame) return
  cancelAnimationFrame(scrollFrame)
  scrollFrame = 0
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
  globalThis.scrollTo(0, y)
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function scrollQuestionIntoView(item: HTMLElement): void {
  cancelQuestionScroll()
  if (prefersReducedMotion()) {
    item.scrollIntoView({ block: 'start' })
    return
  }

  const startY = globalThis.scrollY
  const startTime = performance.now()

  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / FAQ_SCROLL_DURATION_MS)
    // Re-read each frame: a sibling closing above this question moves it up.
    const destination = questionScrollDestination(item)
    applyScroll(startY + (destination - startY) * easeOutCubic(t))
    if (t < 1) {
      scrollFrame = requestAnimationFrame(step)
      return
    }
    scrollFrame = 0
  }
  scrollFrame = requestAnimationFrame(step)
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

export function closeFaqPanel(item: HTMLDetailsElement): void {
  item.dataset.faqExpanded = 'false'
  const panel = panelOf(item)
  if (!panel || prefersReducedMotion()) {
    if (panel) delete panel.dataset.open
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
    if (other !== item && isExpanded(other)) closeFaqPanel(other)
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
