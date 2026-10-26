import Lenis from 'lenis'

declare global {
  interface Window {
    /** Live Lenis instance for programmatic scrolls (FAQ, etc.). */
    __siteLenis?: Lenis | null
  }
}

// Seconds for the easing animation to catch up after a scroll impulse.
// Mirrors the Framer prototype's Smooth Scroll component (intensity: 9 →
// duration: 9/10). Doesn't affect scroll resistance — that's wheelMultiplier.
const DURATION_SECONDS = 0.9

// Lower = more resistance per wheel tick; native = 1.
const WHEEL_MULTIPLIER = 0.8

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// Lenis is a desktop-input affordance (wheel easing, drag-scroll resistance)
// — mobile scrolling is already touch-native and doesn't need it.
const tabletUp = window.matchMedia('(min-width: 810px)')

let lenis: Lenis | null = null

function start(): void {
  if (lenis) return
  lenis = new Lenis({
    duration: DURATION_SECONDS,
    wheelMultiplier: WHEEL_MULTIPLIER,
    autoRaf: true
    // autoResize (default true) recomputes Lenis's scroll limit on reflow
    // (zoom, late-loading media). Without it the limit goes stale and
    // wheel/key scrolling can't reach the bottom of a taller page.
  })
  window.__siteLenis = lenis
}

function stop(): void {
  if (!lenis) return
  lenis.destroy()
  lenis = null
  window.__siteLenis = null
}

function isInPageAnchor(link: HTMLAnchorElement): boolean {
  return (
    link.hash !== '' &&
    link.origin === location.origin &&
    link.pathname === location.pathname
  )
}

/**
 * A same-page anchor click starts the browser's own scroll to the target, but
 * Lenis is still easing toward its last wheel target for up to
 * DURATION_SECONDS and writes that position every frame, so the jump is
 * dragged back and only lands on a second click. Settle Lenis where it is
 * first; the native jump then keeps scroll-margin and focus handling.
 */
function settleBeforeAnchorJump(event: MouseEvent): void {
  if (!lenis || !(event.target instanceof Element)) return
  const link = event.target.closest('a')
  if (!link || !isInPageAnchor(link)) return
  lenis.scrollTo(window.scrollY, { immediate: true, force: true })
}

document.addEventListener('click', settleBeforeAnchorJump, { capture: true })

function init(): void {
  if (reducedMotion.matches || !tabletUp.matches) return
  start()
}

function scheduleInit(): void {
  const run = (): void => init()
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 2000 })
  } else {
    requestAnimationFrame(run)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleInit, { once: true })
} else {
  scheduleInit()
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches || !tabletUp.matches) stop()
  else start()
})
