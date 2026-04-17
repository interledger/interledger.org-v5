import { initHeaderNav } from '@/scripts/header-nav'

const navId = 'block-summit-navigation'
const rootSelector = `#${navId}`
const headerRoot = document.querySelector<HTMLElement>(rootSelector)
if (headerRoot) {
  initHeaderNav(navId, 'summitMenuIcon')

  // Mark active navigation links (Summit-specific)
  const currentPath = window.location.pathname
  const navLinks = headerRoot.querySelectorAll('[data-nav-list] a')

  navLinks.forEach((link) => {
    if (link instanceof HTMLAnchorElement) {
      const normalizedCurrentPath = currentPath.replace(/\/$/, '')
      const normalizedLinkPath = link.pathname.replace(/\/$/, '')

      const isExactMatch = normalizedCurrentPath === normalizedLinkPath
      const isSubpageMatch =
        normalizedLinkPath !== '/summit' &&
        normalizedCurrentPath.startsWith(normalizedLinkPath)

      if (isExactMatch || isSubpageMatch) {
        link.setAttribute('data-active', 'true')
        link.setAttribute('aria-current', 'page')

        const parentMenu = link.closest("[data-menu-level='1']")
        const parentButton = parentMenu?.querySelector('button')
        if (parentButton) {
          parentButton.setAttribute('data-active', 'true')
        }
      }
    }
  })
}
