/**
 * Scroll-driven chevron spring controller for HackathonAnimation.astro.
 *
 * Unlike animated-network.ts (a stateless progress→value function that only
 * needs to run on scroll/resize), a spring has persisted velocity that must
 * keep integrating after scrolling stops until it settles — so this runs a
 * continuous rAF loop for as long as the section is near the viewport,
 * rather than gating ticks on scroll/resize events.
 *
 * Listener lifecycle is managed with AbortController so resize/scroll/media-query
 * handlers are fully removed on teardown, page hide, and Astro view transitions.
 */

/** Figma spec: stiffness 600, damping 60, mass 1. */
const SPRING_STIFFNESS = 600
const SPRING_DAMPING = 60
const SPRING_MASS = 1

/** Pre-promote compositor layers shortly before the section enters view. */
const VIEWPORT_NEAR_MARGIN_PX = 200

/**
 * Fraction of the chevron stage's own height that should already be
 * scrolled into view before the spring starts moving — a brief pause so the
 * resting chevrons are visible for a beat, rather than animating from the
 * instant the section (padding included) touches the viewport edge.
 */
const START_DELAY_STAGE_FRACTION = 0.5

const HACKATHON_ANIMATION_SECTION_SELECTOR =
  '[data-component="HackathonAnimation"]'
const CHEVRON_SELECTOR = '.chevron'

type ChevronSide = 'left' | 'right'

type ChevronState = {
  element: HTMLElement
  side: ChevronSide
  /** Fraction of this side's edge distance this chevron travels; 1 = the large chevron, which defines the edge distance itself. */
  ratio: number
  x: number
  v: number
}

type ScrollControllerState = {
  section: HTMLElement | null
  abort: AbortController | null
  rafId: number
  sectionTop: number
  /** Live pixel gap from each side's large chevron's resting position to that side's screen edge. */
  edgeDistance: Record<ChevronSide, number>
  /** Extra scroll (px) the section's top edge must travel past viewport-entry before the spring starts moving. */
  startDelayPx: number
  isNear: boolean
  chevrons: ChevronState[]
  lastTickTime: number | null
}

const scrollController: ScrollControllerState = {
  section: null,
  abort: null,
  rafId: 0,
  sectionTop: 0,
  edgeDistance: { left: 0, right: 0 },
  startDelayPx: 0,
  isNear: false,
  chevrons: [],
  lastTickTime: null
}

let moduleCleanup: (() => void) | null = null
let cachedReducedMotion: MediaQueryList | null = null

function getReducedMotionQuery(): MediaQueryList {
  if (!cachedReducedMotion) {
    cachedReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  }
  return cachedReducedMotion
}

function getSection(root: ParentNode = document): HTMLElement | null {
  const section = root.querySelector(HACKATHON_ANIMATION_SECTION_SELECTOR)
  return section instanceof HTMLElement ? section : null
}

function readChevrons(section: HTMLElement): ChevronState[] {
  return Array.from(section.querySelectorAll(CHEVRON_SELECTOR))
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .map((element) => ({
      element,
      side: element.dataset.chevronSide === 'right' ? 'right' : 'left',
      ratio: Number.parseFloat(element.dataset.chevronRatio ?? '0'),
      x: 0,
      v: 0
    }))
}

/**
 * Cancels the full-bleed div's natural offset from the viewport edge via
 * `translate`, whose value is self-referential to this div's own box rather
 * than a percentage of the (unreliable — see HackathonAnimation.astro)
 * ancestor width. Must reset to 0 before measuring or a stale shift from a
 * previous call would be baked into the new reading.
 */
function applyFullBleedShift(section: HTMLElement): void {
  const fullBleed = section.querySelector('.hackathon-fullbleed')
  if (!(fullBleed instanceof HTMLElement)) return

  fullBleed.style.setProperty('--hackathon-fullbleed-shift', '0px')
  const { left } = fullBleed.getBoundingClientRect()
  fullBleed.style.setProperty('--hackathon-fullbleed-shift', `${-left}px`)
}

/** Pixel gap from a side's large chevron's resting edge to that side's screen edge. */
function measureEdgeDistance(section: HTMLElement, side: ChevronSide): number {
  const large = section.querySelector(
    `[data-chevron-side="${side}"][data-chevron-size="large"]`
  )
  if (!(large instanceof HTMLElement)) return 0

  const stage = section.querySelector('.hackathon-animation-stage')
  const stageWidth =
    stage instanceof HTMLElement ? stage.offsetWidth : section.offsetWidth

  return side === 'left'
    ? large.offsetLeft
    : stageWidth - (large.offsetLeft + large.offsetWidth)
}

/**
 * Pixels from the section's own top edge (padding included) to the point
 * where `START_DELAY_STAGE_FRACTION` of the chevron stage has scrolled into
 * view — measured from the DOM rather than hardcoded, so it stays correct
 * across breakpoints where both the padding and the stage height differ.
 */
function measureStartDelay(section: HTMLElement): number {
  const stage = section.querySelector('.hackathon-animation-stage')
  if (!(stage instanceof HTMLElement)) return 0

  const stageTopOffset =
    stage.getBoundingClientRect().top - section.getBoundingClientRect().top
  return stageTopOffset + stage.offsetHeight * START_DELAY_STAGE_FRACTION
}

function cacheSectionBounds(section: HTMLElement): void {
  applyFullBleedShift(section)

  const rect = section.getBoundingClientRect()
  scrollController.sectionTop = rect.top + window.scrollY
  scrollController.startDelayPx = measureStartDelay(section)
  scrollController.edgeDistance = {
    left: measureEdgeDistance(section, 'left'),
    right: measureEdgeDistance(section, 'right')
  }
}

function clearInlineStyles(): void {
  for (const chevron of scrollController.chevrons) {
    chevron.element.style.removeProperty('--chevron-x')
    chevron.x = 0
    chevron.v = 0
  }
}

/**
 * View progress from 0 — `startDelayPx` past the section's viewport entry,
 * so the resting chevrons are visible for a beat before they move — to 1
 * (section top — where the large chevrons' top edge sits — at mid-viewport,
 * unchanged). Reaching the midpoint that fast, rather than waiting for the
 * whole section to pass through, is what makes the chevrons feel fully
 * extended by the time they're half-scrolled into view.
 */
export function getViewProgress(): number {
  const sectionTopInViewport = scrollController.sectionTop - window.scrollY
  const start = window.innerHeight - scrollController.startDelayPx
  const end = window.innerHeight / 2
  const progress = (start - sectionTopInViewport) / (start - end)
  return Math.min(1, Math.max(0, progress))
}

/**
 * Spring target position for a chevron at the given view progress. Left
 * chevrons travel negative (toward the left edge), right chevrons positive
 * (toward the right edge); `ratio` of 1 reaches `edgeDistance` exactly.
 */
export function getChevronTarget(
  viewProgress: number,
  side: ChevronSide,
  ratio: number,
  edgeDistance: number
): number {
  const direction = side === 'left' ? -1 : 1
  return viewProgress * ratio * edgeDistance * direction
}

/** One semi-implicit Euler step of the spring integrator. */
export function stepSpring(
  x: number,
  v: number,
  target: number,
  dt: number,
  stiffness = SPRING_STIFFNESS,
  damping = SPRING_DAMPING,
  mass = SPRING_MASS
): { x: number; v: number } {
  const force = stiffness * (target - x) - damping * v
  const nextV = v + (force / mass) * dt
  const nextX = x + nextV * dt
  return { x: nextX, v: nextV }
}

function setCompositing(section: HTMLElement, enabled: boolean): void {
  section.classList.toggle('hackathon-animation--compositing', enabled)
}

function isScrollControllerActive(): boolean {
  return (
    scrollController.abort !== null && !scrollController.abort.signal.aborted
  )
}

/** Removes listeners, stops the rAF loop, and resets chevrons to resting position. */
export function destroyScrollController(): void {
  if (scrollController.rafId !== 0) {
    cancelAnimationFrame(scrollController.rafId)
    scrollController.rafId = 0
  }

  scrollController.abort?.abort()
  scrollController.abort = null
  scrollController.lastTickTime = null

  const section = scrollController.section
  if (section) {
    section.classList.remove('hackathon-animation--compositing')
    clearInlineStyles()
  }

  scrollController.section = null
  scrollController.chevrons = []
}

function tick(time: number): void {
  const section = scrollController.section
  if (!section?.isConnected) {
    destroyScrollController()
    return
  }

  if (!scrollController.isNear) {
    scrollController.lastTickTime = null
    scrollController.rafId = requestAnimationFrame(tick)
    return
  }

  const dt =
    scrollController.lastTickTime === null
      ? 0
      : Math.min(0.1, (time - scrollController.lastTickTime) / 1000)
  scrollController.lastTickTime = time

  const viewProgress = getViewProgress()

  for (const chevron of scrollController.chevrons) {
    const target = getChevronTarget(
      viewProgress,
      chevron.side,
      chevron.ratio,
      scrollController.edgeDistance[chevron.side]
    )
    const next = stepSpring(chevron.x, chevron.v, target, dt)
    chevron.x = next.x
    chevron.v = next.v
    chevron.element.style.setProperty('--chevron-x', `${chevron.x}px`)
  }

  scrollController.rafId = requestAnimationFrame(tick)
}

function attachScrollController(section: HTMLElement): void {
  destroyScrollController()

  const abort = new AbortController()
  const { signal } = abort
  scrollController.section = section
  scrollController.abort = abort
  scrollController.chevrons = readChevrons(section)
  cacheSectionBounds(section)

  const observer = new IntersectionObserver(
    (entries) => {
      scrollController.isNear = entries[0].isIntersecting
      setCompositing(section, scrollController.isNear)
    },
    { rootMargin: `${VIEWPORT_NEAR_MARGIN_PX}px` }
  )
  observer.observe(section)
  signal.addEventListener('abort', () => observer.disconnect())

  window.addEventListener('resize', () => cacheSectionBounds(section), {
    passive: true,
    signal
  })

  scrollController.rafId = requestAnimationFrame(tick)
}

/**
 * Applies the full-bleed shift independent of the spring controller's
 * attach/destroy lifecycle — reduced-motion users still need the section to
 * sit flush against the screen edges, they just skip the scroll spring.
 */
function syncFullBleedLayout(): void {
  const section = getSection()
  if (section?.isConnected) applyFullBleedShift(section)
}

function syncScrollController(): void {
  const section = getSection()
  const reducedMotion = getReducedMotionQuery()

  if (!section?.isConnected || reducedMotion.matches) {
    destroyScrollController()
    return
  }

  if (scrollController.section === section && isScrollControllerActive()) {
    return
  }

  attachScrollController(section)
}

/**
 * Registers module-level listeners (reduced-motion, navigation, Astro
 * transitions). Returns a cleanup function that aborts every listener and
 * tears down the controller. Safe to call more than once (e.g. HMR).
 */
export function initHackathonAnimation(): () => void {
  moduleCleanup?.()
  destroyScrollController()
  cachedReducedMotion = null

  const abort = new AbortController()
  const { signal } = abort

  const syncAll = (): void => {
    syncFullBleedLayout()
    syncScrollController()
  }

  getReducedMotionQuery().addEventListener('change', syncScrollController, {
    signal
  })
  window.addEventListener('resize', syncFullBleedLayout, {
    passive: true,
    signal
  })
  window.addEventListener('pagehide', () => destroyScrollController(), {
    signal
  })
  window.addEventListener('pageshow', syncAll, { signal })

  document.addEventListener('astro:before-swap', destroyScrollController, {
    signal
  })
  document.addEventListener('astro:page-load', syncAll, {
    signal
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAll, {
      once: true,
      signal
    })
  } else {
    syncAll()
  }

  const cleanup = (): void => {
    abort.abort()
    destroyScrollController()
    cachedReducedMotion = null
    moduleCleanup = null
  }

  moduleCleanup = cleanup
  return cleanup
}

if (typeof window !== 'undefined') {
  initHackathonAnimation()
}
