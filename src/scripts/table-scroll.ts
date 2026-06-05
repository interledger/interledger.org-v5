/**
 * Arrow-key horizontal scrolling for focusable `.table-scroll` regions (WCAG 2.1.1).
 */
const SCROLL_STEP_PX = 48

function isTableScrollRegion(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.classList.contains('table-scroll')
}

document.addEventListener('keydown', (event) => {
  if (!isTableScrollRegion(document.activeElement)) return

  const region = document.activeElement
  let delta = 0

  switch (event.key) {
    case 'ArrowLeft':
      delta = -SCROLL_STEP_PX
      break
    case 'ArrowRight':
      delta = SCROLL_STEP_PX
      break
    case 'Home':
      region.scrollLeft = 0
      event.preventDefault()
      return
    case 'End':
      region.scrollLeft = region.scrollWidth
      event.preventDefault()
      return
    default:
      return
  }

  region.scrollLeft += delta
  event.preventDefault()
})
