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

  switch (event.key) {
    case 'ArrowLeft':
      region.scrollLeft += -SCROLL_STEP_PX
      event.preventDefault()
      break
    case 'ArrowRight':
      region.scrollLeft += SCROLL_STEP_PX
      event.preventDefault()
      break
    case 'Home':
      region.scrollLeft = 0
      event.preventDefault()
      break
    case 'End':
      region.scrollLeft = region.scrollWidth
      event.preventDefault()
      break
    default:
      return
  }
})
