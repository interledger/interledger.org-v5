/**
 * Scroll-driven chevron spring controller for HackathonAnimation.astro.
 *
 * Unlike animated-network.ts (a stateless progress→value function that only
 * needs to run on scroll/resize), a spring has persisted velocity that must
 * keep integrating after scrolling stops until it settles — so while the
 * section is near the viewport, this runs a per-frame rAF loop instead of
 * gating ticks on scroll/resize events. The loop itself starts and stops
 * with the IntersectionObserver's near/far transitions (see `scheduleTick`),
 * so it never spins in the background on long pages where the section is
 * off-screen.
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
 * Mobile browsers fire many `resize` events as the address bar collapses or
 * expands *during* an active scroll gesture, not just on rotation. Recomputing
 * geometry on every one of them would repeatedly shift the cached
 * `sectionTop`/`viewportHeight` the spring reads from mid-animation — read
 * mid-transition, those measurements are themselves transient, so this looks
 * like the chevrons drifting on their own or never quite settling. Debouncing
 * means we only resync once a resize burst actually settles.
 */
const RESIZE_DEBOUNCE_MS = 150

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
  /** Cached alongside sectionTop so both reflect the same moment — see RESIZE_DEBOUNCE_MS. */
  viewportHeight: number
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
  viewportHeight: 0,
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
  scrollController.viewportHeight = window.innerHeight
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

/** Below this, `start - end` is treated as collapsed rather than divided by. */
const MIN_PROGRESS_WINDOW_PX = 1e-3

/**
 * View progress from 0 (`sectionTopInViewport` at `start`) to 1 (at `end`).
 *
 * `start` and `end` can coincide (a very short viewport, or startDelayPx
 * landing exactly on innerHeight/2), which would otherwise divide by ~0 and
 * hand a spring target of NaN — that propagates into `--chevron-x: NaNpx`
 * and permanently breaks the chevron's transform. A collapsed window has no
 * scroll distance to interpolate over, so step straight to whichever side
 * of the (single) threshold the section is currently on.
 */
export function computeViewProgress(
  sectionTopInViewport: number,
  start: number,
  end: number
): number {
  const progressWindowPx = start - end

  if (Math.abs(progressWindowPx) < MIN_PROGRESS_WINDOW_PX) {
    return sectionTopInViewport <= start ? 1 : 0
  }

  const progress = (start - sectionTopInViewport) / progressWindowPx
  return Math.min(1, Math.max(0, progress))
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
  const start = scrollController.viewportHeight - scrollController.startDelayPx
  const end = scrollController.viewportHeight / 2
  return computeViewProgress(sectionTopInViewport, start, end)
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

/**
 * Largest single `stepSpring` step (seconds) that stays numerically stable
 * for SPRING_STIFFNESS/SPRING_DAMPING/SPRING_MASS. Semi-implicit Euler on a
 * damped oscillator is only conditionally stable: solving the Jury
 * conditions on this spring's discrete update matrix puts the boundary at
 * dt ≈ 0.0291s for these constants — past it, position/velocity grow
 * exponentially every step instead of converging, entirely independent of
 * the target (verified: a single dt=0.1 step repeated 10 times reaches
 * x ≈ -8×10^11). A dropped frame during scroll (very common on mobile,
 * exactly when this is animating) easily produces a dt that large, which is
 * what made the chevrons fly to huge off-screen positions and keep drifting
 * with no relation to scroll position. Comfortably under the ~0.0291s
 * boundary, with margin for the constants ever being tuned.
 */
const MAX_STABLE_SPRING_DT = 1 / 120

/**
 * Integrates the spring across `dt` using however many `MAX_STABLE_SPRING_DT`
 * substeps that takes, instead of one `stepSpring` call with a potentially
 * unstable `dt`. Splitting a large step into several small ones changes
 * nothing about a converging spring's trajectory (that's just smaller
 * increments of the same motion) — it only matters for the large, rare `dt`
 * values that would otherwise diverge.
 */
export function integrateSpring(
  x: number,
  v: number,
  target: number,
  dt: number
): { x: number; v: number } {
  const steps = Math.ceil(dt / MAX_STABLE_SPRING_DT)
  if (steps <= 0) return { x, v }

  const subDt = dt / steps
  let state = { x, v }
  for (let i = 0; i < steps; i++) {
    state = stepSpring(state.x, state.v, target, subDt)
  }
  return state
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
  scrollController.isNear = false

  const section = scrollController.section
  if (section) {
    section.classList.remove('hackathon-animation--compositing')
    clearInlineStyles()
  }

  scrollController.section = null
  scrollController.chevrons = []
}

/** Starts the rAF loop if it isn't already running. */
function scheduleTick(): void {
  if (scrollController.rafId !== 0) return
  scrollController.rafId = requestAnimationFrame(tick)
}

function tick(time: number): void {
  const section = scrollController.section
  if (!section?.isConnected) {
    destroyScrollController()
    return
  }

  // Stop rather than keep polling every frame — the IntersectionObserver
  // callback below restarts the loop once the section is near again, so
  // there's no need to burn a rAF callback per frame while it's off-screen.
  if (!scrollController.isNear) {
    scrollController.lastTickTime = null
    scrollController.rafId = 0
    return
  }

  // The 0.1s cap here only bounds how far the spring tries to "catch up"
  // after a long pause (backgrounded tab, etc.) — it does not need to be
  // small enough for integration stability, since integrateSpring substeps
  // internally regardless of how large dt is.
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
    const next = integrateSpring(chevron.x, chevron.v, target, dt)
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

  // The loop only starts here, on the near → true transition — not
  // unconditionally on attach — so it never spins while off-screen.
  const observer = new IntersectionObserver(
    (entries) => {
      const wasNear = scrollController.isNear
      scrollController.isNear = entries[0].isIntersecting
      setCompositing(section, scrollController.isNear)
      if (scrollController.isNear && !wasNear) scheduleTick()
    },
    { rootMargin: `${VIEWPORT_NEAR_MARGIN_PX}px` }
  )
  observer.observe(section)
  signal.addEventListener('abort', () => observer.disconnect())

  let resizeTimeoutId = 0
  const onResize = (): void => {
    window.clearTimeout(resizeTimeoutId)
    resizeTimeoutId = window.setTimeout(
      () => cacheSectionBounds(section),
      RESIZE_DEBOUNCE_MS
    )
  }
  window.addEventListener('resize', onResize, { passive: true, signal })
  signal.addEventListener('abort', () => window.clearTimeout(resizeTimeoutId))
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
