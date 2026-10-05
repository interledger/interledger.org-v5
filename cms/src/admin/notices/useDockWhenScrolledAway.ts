/**
 * Tracks whether the notice bar's in-flow slot has scrolled out of view, so the
 * bar can dock to the bottom of the content column instead of disappearing.
 *
 * Why the bottom: Strapi's own page header swaps in a `position: fixed; top: 0`
 * copy once it scrolls away, and the content-manager SubNav is sticky at
 * `top: 0` too. Anything pinned to the top would fight both; the bottom edge is
 * free.
 *
 * The slot, not the bar, is what gets observed. When the bar leaves the flow
 * the slot keeps its height, so observing it stays stable instead of flipping
 * back the moment the bar is docked.
 */
import * as React from 'react'

export interface DockedSlot {
  isDocked: boolean
  /** Last measured height of the bar, held by the slot while it is docked. */
  heightPx: number
  /** The slot's horizontal extent, so the docked bar lines up with the column. */
  leftPx: number
  widthPx: number
}

const INITIAL_SLOT: DockedSlot = {
  isDocked: false,
  heightPx: 0,
  leftPx: 0,
  widthPx: 0
}

export function useDockWhenScrolledAway<
  TSlot extends HTMLElement,
  TBar extends HTMLElement
>(
  slotRef: React.RefObject<TSlot | null>,
  barRef: React.RefObject<TBar | null>,
  isActive: boolean
): DockedSlot {
  const [slot, setSlot] = React.useState<DockedSlot>(INITIAL_SLOT)

  React.useEffect(() => {
    const slotElement = slotRef.current
    const barElement = barRef.current
    if (!isActive || !slotElement || !barElement) {
      setSlot(INITIAL_SLOT)
      return
    }

    const measure = () => {
      const { left, width } = slotElement.getBoundingClientRect()
      setSlot((current) => ({
        ...current,
        heightPx: barElement.offsetHeight,
        leftPx: left,
        widthPx: width
      }))
    }

    const intersection = new IntersectionObserver(([entry]) => {
      if (!entry) return
      setSlot((current) => ({ ...current, isDocked: !entry.isIntersecting }))
    })
    // The bar resizes when its copy changes; the slot when the column does.
    const resize = new ResizeObserver(measure)

    intersection.observe(slotElement)
    resize.observe(slotElement)
    resize.observe(barElement)
    window.addEventListener('resize', measure)
    measure()

    return () => {
      intersection.disconnect()
      resize.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [slotRef, barRef, isActive])

  return slot
}
