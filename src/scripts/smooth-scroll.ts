import Lenis from 'lenis'

// duration in seconds. Mirrors the Framer prototype's Smooth Scroll
// component (intensity: 9 → duration: 9/10).
const DURATION_SECONDS = 0.9

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

let lenis: Lenis | null = null
let rafId: number | null = null

function tagOverflowElements(): void {
  for (const el of document.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue
    if (getComputedStyle(el).overflow === 'auto') {
      el.setAttribute('data-lenis-prevent', '')
    }
  }
}

function getHeaderOffset(): number {
  const header = document.querySelector('.foundation-header')
  return header instanceof HTMLElement ? header.offsetHeight : 0
}

function findAnchorTarget(hash: string): HTMLElement | null {
  try {
    const el = document.querySelector(decodeURIComponent(hash))
    return el instanceof HTMLElement ? el : null
  } catch {
    return null
  }
}

function onAnchorClick(event: MouseEvent): void {
  if (!lenis) return
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return
  }

  const target = event.target
  if (!(target instanceof Element)) return

  const anchor = target.closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement)) return

  if (anchor.origin !== window.location.origin) return
  if (anchor.pathname !== window.location.pathname) return

  const hash = anchor.hash
  if (!hash || hash === '#') return

  const destination = findAnchorTarget(hash)
  if (!destination) return

  event.preventDefault()
  const scrollMarginTop =
    parseFloat(getComputedStyle(destination).scrollMarginTop) || 0
  const offset = scrollMarginTop || getHeaderOffset()
  lenis.scrollTo(destination, { offset: -offset })
}

function start(): void {
  if (lenis) return
  lenis = new Lenis({ duration: DURATION_SECONDS })
  tagOverflowElements()

  const raf = (time: number) => {
    lenis?.raf(time)
    rafId = lenis ? requestAnimationFrame(raf) : null
  }
  rafId = requestAnimationFrame(raf)

  document.addEventListener('click', onAnchorClick)
}

function stop(): void {
  if (!lenis) return
  document.removeEventListener('click', onAnchorClick)
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
  lenis.destroy()
  lenis = null
}

function init(): void {
  if (reducedMotion.matches) return
  start()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) stop()
  else start()
})
