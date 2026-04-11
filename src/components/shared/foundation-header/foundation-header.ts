import { initHeaderNav } from '@/scripts/header-nav'

const navId = 'block-interledger-mainnavigation'
const rootSelector = `#${navId}`
const headerRoot = document.querySelector<HTMLElement>(rootSelector)
if (headerRoot) {
  initHeaderNav(navId, 'foundationMenuIcon')

  // Mark active navigation links (Foundation-specific: developer links + blog section)
  const devLinks = headerRoot.querySelectorAll(
    "[data-menu-level='2'] a[href*='/developers']"
  )
  let currentPath = window.location.pathname

  if (currentPath.endsWith('/')) {
    currentPath = currentPath.slice(0, -1)
  }

  const activeSections = ['/blog']
  devLinks.forEach((devLink) => {
    if (devLink instanceof HTMLAnchorElement) {
      const linkPath = devLink.pathname
      const isExactMatch = linkPath === currentPath

      const isSectionMatch = activeSections.some(
        (section) =>
          currentPath.startsWith(section) && linkPath.startsWith(section)
      )

      if (isExactMatch || isSectionMatch) {
        const parentMenu = devLink.closest("[data-menu-level='1']")
        const parentMenuLink = parentMenu?.querySelector('button')

        devLink.setAttribute('data-active', 'true')
        parentMenuLink?.setAttribute('data-active', 'true')
      }
    }
  })
}
