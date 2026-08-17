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

const HACKATHON_ANIMATION_SECTION_SELECTOR =
  '[data-component="HackathonAnimation"]'
const CHEVRON_SELECTOR = '.chevron'

type ChevronState = {
  element: HTMLElement
  offset: number
  x: number
  v: number
}

type ScrollControllerState = {
  section: HTMLElement | null
  abort: AbortController | null
  rafId: number
  sectionTop: number
  stageHeight: number
  isNear: boolean
  chevrons: ChevronState[]
  lastTickTime: number | null
}

const scrollController: ScrollControllerState = {
  section: null,
  abort: null,
  rafId: 0,
  sectionTop: 0,
  stageHeight: 0,
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
      offset: Number.parseFloat(element.dataset.chevronOffset ?? '0'),
      x: 0,
      v: 0
    }))
}

function cacheSectionBounds(section: HTMLElement): void {
  const rect = section.getBoundingClientRect()
  scrollController.sectionTop = rect.top + window.scrollY

  const stage = section.querySelector('.hackathon-animation-stage')
  scrollController.stageHeight =
    stage instanceof HTMLElement ? stage.offsetHeight : section.offsetHeight
}

function clearInlineStyles(): void {
  for (const chevron of scrollController.chevrons) {
    chevron.element.style.removeProperty('--chevron-x')
    chevron.x = 0
    chevron.v = 0
  }
}

/** View progress across the section's scroll through the viewport, clamped 0–1. */
export function getViewProgress(): number {
  const progress =
    (window.scrollY + window.innerHeight - scrollController.sectionTop) /
    (scrollController.sectionHeight + window.innerHeight)
  return Math.min(1, Math.max(0, progress))
}

/** Spring target position for a chevron at the given view progress. */
export function getChevronTarget(
  viewProgress: number,
  offset: number,
  stageHeight: number
): number {
  return viewProgress * offset * stageHeight
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
      chevron.offset,
      scrollController.stageHeight
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

  getReducedMotionQuery().addEventListener('change', syncScrollController, {
    signal
  })
  window.addEventListener('pagehide', () => destroyScrollController(), {
    signal
  })
  window.addEventListener('pageshow', syncScrollController, { signal })

  document.addEventListener('astro:before-swap', destroyScrollController, {
    signal
  })
  document.addEventListener('astro:page-load', syncScrollController, {
    signal
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncScrollController, {
      once: true,
      signal
    })
  } else {
    syncScrollController()
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
