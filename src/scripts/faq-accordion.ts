/**
 * Exclusive FAQ questions: opening one closes the others in the same
 * accordion, then scrolls the opened question under the site header.
 * Grant FAQ sets `data-faq-hold-position`. At the desktop breakpoint its
 * title column is sticky, so pinning a question under the header drags
 * that column. There the page only scrolls as far as the column can stay
 * stuck: undo a question lifted by a closing answer above, clear the
 * header, and bring an answer that ends below the fold into view without
 * pushing the question under the header. Narrower screens keep the pin.
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
const HOLD_KEY = 'faqHoldPosition'
const GRANT_SECTION_SELECTOR = '[data-component="GrantFaqSection"]'
// The grant title column is `desktop:sticky`. Same tier as tailwind.config.mjs.
const DESKTOP_STICKY_QUERY = '(min-width: 1200px)'

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

function headerClearance(item: HTMLElement): number {
  const margin = parseFloat(getComputedStyle(item).scrollMarginTop)
  return Number.isFinite(margin) ? margin : 0
}

/** Document Y that puts the question top just under the header. */
export function questionScrollDestination(item: HTMLElement): number {
  return (
    globalThis.scrollY +
    item.getBoundingClientRect().top -
    headerClearance(item)
  )
}

function applyScroll(y: number): void {
  const top = Math.max(0, y)
  const lenis = siteLenis()
  if (lenis) {
    lenis.scrollTo(top, { immediate: true })
    return
  }
  globalThis.scrollTo({ top, behavior: 'instant' })
}

function isLastAccordionItem(item: HTMLElement): boolean {
  const root = item.closest(ACCORDION_SELECTOR)
  if (!root) return false
  const items = root.querySelectorAll(ITEM_SELECTOR)
  return items.length > 0 && items[items.length - 1] === item
}

/** Desktop grant FAQ. The sticky title is not on screen below that breakpoint. */
function holdsPosition(item: HTMLElement): boolean {
  const root = item.closest(ACCORDION_SELECTOR) as HTMLElement | null
  if (root?.dataset[HOLD_KEY] !== 'true') return false
  return globalThis.matchMedia(DESKTOP_STICKY_QUERY).matches
}

/**
 * How far the page can scroll up before a stuck title column moves.
 * Once the section top reaches the column's sticky offset, more upward
 * scroll carries the column with it.
 */
export function stickyUpwardRoom(item: HTMLElement): number {
  const section = item.closest(GRANT_SECTION_SELECTOR) as HTMLElement | null
  const column = section?.firstElementChild as HTMLElement | null
  if (!section || !column) return globalThis.scrollY
  const stickyTop = parseFloat(getComputedStyle(column).top)
  if (!Number.isFinite(stickyTop)) return globalThis.scrollY
  const sectionTop = section.getBoundingClientRect().top
  if (sectionTop >= stickyTop) return 0
  return stickyTop - sectionTop
}

function expandedAnswerBottom(item: HTMLElement): number {
  const rect = item.getBoundingClientRect()
  const itemBottom = Number.isFinite(rect.bottom) ? rect.bottom : rect.top
  const panel = panelOf(item)
  const inner = panel?.firstElementChild as HTMLElement | null
  if (!panel || !inner) return itemBottom
  const panelHeight = panel.getBoundingClientRect().height
  const contentHeight = inner.scrollHeight
  if (!Number.isFinite(contentHeight) || contentHeight <= panelHeight) {
    return itemBottom
  }
  return itemBottom - panelHeight + contentHeight
}

export type HoldPositionScroll = {
  scrollY: number
  topBefore: number
  topAfter: number
  headerGap: number
  upwardRoom: number
  answerBottom: number
  viewportHeight: number
}

/**
 * Next scroll offset for a desktop grant FAQ click.
 * Upward scroll stops at the page top and at `upwardRoom`, so a stuck
 * title column is not pulled off. Downward scroll only covers an answer
 * that ends below the fold, and stops once the question meets the header.
 */
export function holdPositionScrollY(input: HoldPositionScroll): number {
  let y = input.scrollY
  let top = input.topAfter
  let bottom = input.answerBottom
  let room = Math.max(0, Math.min(input.scrollY, input.upwardRoom))

  const lifted = input.topBefore - input.topAfter
  if (lifted > 0 && room > 0) {
    const applied = Math.min(lifted, room)
    y -= applied
    top += applied
    bottom += applied
    room -= applied
  }

  if (top < input.headerGap && room > 0) {
    const applied = Math.min(input.headerGap - top, room)
    y -= applied
    top += applied
    bottom += applied
  }

  if (input.viewportHeight > 0 && bottom > input.viewportHeight) {
    const overflow = bottom - input.viewportHeight
    const downRoom = Math.max(0, top - input.headerGap)
    y += Math.min(overflow, downRoom)
  }

  return Math.max(0, y)
}

/** Grant FAQ on desktop. Measures, then applies `holdPositionScrollY`. */
export function keepQuestionReadable(
  item: HTMLElement,
  topBefore: number
): void {
  const scrollY = globalThis.scrollY || 0
  const next = holdPositionScrollY({
    scrollY,
    topBefore,
    topAfter: item.getBoundingClientRect().top,
    headerGap: headerClearance(item),
    upwardRoom: stickyUpwardRoom(item),
    answerBottom: expandedAnswerBottom(item),
    viewportHeight: globalThis.innerHeight || 0
  })
  if (next !== scrollY) applyScroll(next)
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

  const hold = holdsPosition(item)
  const topBefore = hold ? item.getBoundingClientRect().top : 0
  for (const other of items) {
    if (other !== item && isExpanded(other)) {
      closeFaqPanel(other, { instant: true })
    }
  }
  openFaqPanel(item)
  if (hold) keepQuestionReadable(item, topBefore)
  else scrollQuestionIntoView(item)
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
