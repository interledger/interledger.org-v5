/**
 * Scroll-driven network section controller.
 *
 * - Firefox / browsers without `animation-timeline: view()` get a JS transform
 *   fallback that mirrors the CSS keyframes in AnimatedNetwork.astro.
 * - `will-change: transform` is toggled via `.network--compositing` only while
 *   the section is near the viewport (tablet+), avoiding permanent GPU layers.
 *
 * Listener lifecycle is managed with AbortController so resize/scroll/media-query
 * handlers are fully removed on teardown, page hide, and Astro view transitions.
 */

/** Matches `theme.screens.tablet` in tailwind.config.mjs (810px). */
export const TABLET_MIN_WIDTH_PX = 810

/** Pre-promote compositor layers shortly before the section enters view. */
const VIEWPORT_NEAR_MARGIN_PX = 200

const ROTATE_START_DEG = -15
const ROTATE_END_DEG = 65
const SCALE = 1.25
/** Matches `--network-circle-max-scale` in AnimatedNetwork.astro (transform scale factor). */
const CIRCLE_SCALE_FACTOR = 80

const NETWORK_SECTION_SELECTOR = '[data-component="AnimatedNetwork"]'

type ScrollControllerState = {
  section: HTMLElement | null
  abort: AbortController | null
  rafId: number
  sectionTop: number
  sectionHeight: number
  isNear: boolean
}

const scrollController: ScrollControllerState = {
  section: null,
  abort: null,
  rafId: 0,
  sectionTop: 0,
  sectionHeight: 0,
  isNear: false
}

let moduleCleanup: (() => void) | null = null

let cachedMedia: {
  reducedMotion: MediaQueryList
  tabletUp: MediaQueryList
} | null = null

function getMediaQueries(): {
  reducedMotion: MediaQueryList
  tabletUp: MediaQueryList
} {
  if (!cachedMedia) {
    cachedMedia = {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      tabletUp: window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH_PX}px)`)
    }
  }
  return cachedMedia
}

/**
 * Matches AnimatedNetwork.astro: `view-timeline: --network-track block` on the
 * section and `animation-timeline: --network-track` on animated elements.
 * `scroll()` timeline support alone is not enough to disable the JS fallback.
 */
export function supportsScrollDrivenAnimations(): boolean {
  return (
    CSS.supports('view-timeline', '--network-track block') &&
    CSS.supports('animation-timeline', '--network-track')
  )
}

function getNetworkSection(root: ParentNode = document): HTMLElement | null {
  const section = root.querySelector(NETWORK_SECTION_SELECTOR)
  return section instanceof HTMLElement ? section : null
}

function cacheSectionBounds(section: HTMLElement): void {
  const rect = section.getBoundingClientRect()
  scrollController.sectionTop = rect.top + window.scrollY
  scrollController.sectionHeight = section.offsetHeight
}

function clearInlineStyles(section: HTMLElement): void {
  const svg = section.querySelector('.network-svg:not(.network-svg--static)')
  const circle = section.querySelector('.growing-circle')

  if (svg instanceof HTMLElement) {
    svg.style.removeProperty('transform')
  }

  if (circle instanceof HTMLElement) {
    circle.style.removeProperty('transform')
    circle.style.removeProperty('opacity')
  }
}

/** View progress for `animation-range: entry 0% exit 100%`. Uses cached geometry + scrollY to avoid layout reads on scroll. */
export function getViewProgress(): number {
  const progress =
    (window.scrollY + window.innerHeight - scrollController.sectionTop) /
    (scrollController.sectionHeight + window.innerHeight)
  return Math.min(1, Math.max(0, progress))
}

/** View progress slice for `animation-range: cover 50% cover 100%`. */
export function getCircleProgress(viewProgress: number): number {
  return Math.min(1, Math.max(0, (viewProgress - 0.5) / 0.5))
}

function getCircleScale(circleProgress: number): number {
  return 1 + circleProgress * (CIRCLE_SCALE_FACTOR - 1)
}

function applyReducedMotionState(section: HTMLElement): void {
  const svg = section.querySelector('.network-svg:not(.network-svg--static)')
  const circle = section.querySelector('.growing-circle')

  if (svg instanceof HTMLElement) {
    svg.style.transform = `rotate(20deg) scale(${SCALE})`
  }

  if (circle instanceof HTMLElement) {
    circle.style.transform = `scale(${CIRCLE_SCALE_FACTOR})`
    circle.style.opacity = '1'
  }
}

function updateNetwork(section: HTMLElement): void {
  const svg = section.querySelector('.network-svg:not(.network-svg--static)')
  const circle = section.querySelector('.growing-circle')

  if (!(svg instanceof HTMLElement) || !(circle instanceof HTMLElement)) return

  const viewProgress = getViewProgress()
  const rotate =
    ROTATE_START_DEG + viewProgress * (ROTATE_END_DEG - ROTATE_START_DEG)

  svg.style.transform = `rotate(${rotate}deg) scale(${SCALE})`

  const circleProgress = getCircleProgress(viewProgress)
  circle.style.transform = `scale(${getCircleScale(circleProgress)})`
  circle.style.opacity = circleProgress > 0 ? '1' : '0'
}

function setCompositing(section: HTMLElement, enabled: boolean): void {
  section.classList.toggle('network--compositing', enabled)
}

function isScrollControllerActive(): boolean {
  return (
    scrollController.abort !== null && !scrollController.abort.signal.aborted
  )
}

/** Removes scroll/resize/motion listeners and resets section inline state. */
export function destroyScrollController(): void {
  if (scrollController.rafId !== 0) {
    cancelAnimationFrame(scrollController.rafId)
    scrollController.rafId = 0
  }

  scrollController.abort?.abort()
  scrollController.abort = null

  const section = scrollController.section
  if (section) {
    section.classList.remove('network--compositing', 'network--js-fallback')
    clearInlineStyles(section)
  }

  scrollController.section = null
}

function tick(section: HTMLElement, tabletUp: MediaQueryList): void {
  if (!section.isConnected) {
    destroyScrollController()
    return
  }

  if (!tabletUp.matches) {
    destroyScrollController()
    return
  }

  const useJsFallback = !supportsScrollDrivenAnimations()
  const { reducedMotion } = getMediaQueries()

  setCompositing(section, scrollController.isNear && !reducedMotion.matches)

  if (!useJsFallback) {
    section.classList.remove('network--js-fallback')
    clearInlineStyles(section)
    return
  }

  section.classList.add('network--js-fallback')

  if (!scrollController.isNear) {
    clearInlineStyles(section)
    return
  }

  if (reducedMotion.matches) {
    applyReducedMotionState(section)
  } else {
    updateNetwork(section)
  }
}

function attachScrollController(
  section: HTMLElement,
  tabletUp: MediaQueryList
): void {
  destroyScrollController()

  const abort = new AbortController()
  const { signal } = abort
  scrollController.section = section
  scrollController.abort = abort

  // Single layout read to seed geometry cache and initial near state.
  const initRect = section.getBoundingClientRect()
  scrollController.sectionTop = initRect.top + window.scrollY
  scrollController.sectionHeight = section.offsetHeight
  scrollController.isNear =
    initRect.bottom >= -VIEWPORT_NEAR_MARGIN_PX &&
    initRect.top <= window.innerHeight + VIEWPORT_NEAR_MARGIN_PX

  // IntersectionObserver keeps isNear updated without touching the DOM on scroll.
  const observer = new IntersectionObserver(
    (entries) => {
      scrollController.isNear = entries[0].isIntersecting
    },
    { rootMargin: `${VIEWPORT_NEAR_MARGIN_PX}px` }
  )
  observer.observe(section)
  signal.addEventListener('abort', () => observer.disconnect())

  let ticking = false

  const scheduleTick = (): void => {
    if (signal.aborted) return
    if (ticking) return
    ticking = true
    scrollController.rafId = requestAnimationFrame(() => {
      scrollController.rafId = 0
      ticking = false
      if (signal.aborted) return
      tick(section, tabletUp)
    })
  }

  const scheduleResizeTick = (): void => {
    cacheSectionBounds(section)
    scheduleTick()
  }

  window.addEventListener('scroll', scheduleTick, { passive: true, signal })
  window.addEventListener('resize', scheduleResizeTick, {
    passive: true,
    signal
  })
  getMediaQueries().reducedMotion.addEventListener('change', scheduleTick, {
    signal
  })

  scheduleTick()
}

function syncScrollController(): void {
  const { tabletUp } = getMediaQueries()
  const section = getNetworkSection()

  if (!section?.isConnected || !tabletUp.matches) {
    destroyScrollController()
    return
  }

  if (scrollController.section === section && isScrollControllerActive()) {
    return
  }

  attachScrollController(section, tabletUp)
}

/**
 * Registers module-level listeners (breakpoint, navigation, Astro transitions).
 * Returns a cleanup function that aborts every listener and tears down the controller.
 * Safe to call more than once (e.g. HMR) — previous listeners are removed first.
 */
export function initAnimatedNetwork(): () => void {
  moduleCleanup?.()
  destroyScrollController()
  cachedMedia = null

  const abort = new AbortController()
  const { signal } = abort

  const onTabletChange = (): void => {
    syncScrollController()
  }

  getMediaQueries().tabletUp.addEventListener('change', onTabletChange, {
    signal
  })
  window.addEventListener('pagehide', () => destroyScrollController(), {
    signal
  })
  window.addEventListener('pageshow', syncScrollController, { signal })

  // Forward-compatible with Astro ClientRouter / view transitions.
  document.addEventListener('astro:before-swap', destroyScrollController, {
    signal
  })
  document.addEventListener('astro:page-load', syncScrollController, { signal })

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
    cachedMedia = null
    moduleCleanup = null
  }

  moduleCleanup = cleanup
  return cleanup
}

if (typeof window !== 'undefined') {
  initAnimatedNetwork()
}
