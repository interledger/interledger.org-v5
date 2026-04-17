import { initHeaderNav } from '@/scripts/header-nav'

const navId = 'block-interledger-mainnavigation'
const rootSelector = `#${navId}`
const headerRoot = document.querySelector<HTMLElement>(rootSelector)
if (headerRoot) {
  initHeaderNav(navId, 'foundationMenuIcon')

  // Mark the single best-matching navigation link based on current path.
  // "Best match" = longest link path that is a prefix of (or exact match for) the current path.
  const allNavLinks = Array.from(
    headerRoot.querySelectorAll("[data-menu-level='2'] a")
  )
  const currentPath = window.location.pathname.replace(/\/$/, '')

  let bestMatch: HTMLAnchorElement | null = null
  let bestMatchLength = 0

  for (const navLink of allNavLinks) {
    if (!(navLink instanceof HTMLAnchorElement)) continue
    const linkPath = navLink.pathname.replace(/\/$/, '')
    if (linkPath.length < 2) continue // skip root-level hrefs
    if (currentPath === linkPath || currentPath.startsWith(linkPath + '/')) {
      if (linkPath.length > bestMatchLength) {
        bestMatch = navLink
        bestMatchLength = linkPath.length
      }
    }
  }

  if (bestMatch) {
    const parentMenu = bestMatch.closest("[data-menu-level='1']")
    const parentMenuLink = parentMenu?.querySelector('button')
    bestMatch.setAttribute('data-active', 'true')
    parentMenuLink?.setAttribute('data-active', 'true')
  }
}
