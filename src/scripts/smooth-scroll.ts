import Lenis from 'lenis'

// Seconds for the easing animation to catch up after a scroll impulse.
// Mirrors the Framer prototype's Smooth Scroll component (intensity: 9 →
// duration: 9/10). Doesn't affect scroll resistance — that's wheelMultiplier.
const DURATION_SECONDS = 0.9

// Lower = more resistance per wheel tick; native = 1.
const WHEEL_MULTIPLIER = 0.8

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

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
}

function stop(): void {
  if (!lenis) return
  lenis.destroy()
  lenis = null
}

function init(): void {
  if (reducedMotion.matches) return
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
  if (reducedMotion.matches) stop()
  else start()
})
