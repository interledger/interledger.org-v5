/**
 * Shared header navigation behavior.
 * Used by both Summit and Foundation headers.
 *
 * All DOM queries are scoped to the nav root identified by `navId`,
 * so multiple headers on the same page won't interfere with each other.
 */

/** Sets up mobile nav toggle, responsive breakpoint handling, and submenu behavior. */
export function initHeaderNav(navId: string, iconId: string) {
  const root = document.getElementById(navId)
  if (!root) return

  const linksWrapper = root.querySelector<HTMLElement>('[data-nav-wrapper]')
  const menuIcon = document.getElementById(iconId)
  const navToggle = root.querySelector<HTMLElement>('[data-nav-toggle]')

  function setOffscreenState(isOffscreen: boolean) {
    if (linksWrapper instanceof HTMLElement) {
      linksWrapper.dataset.offscreen = isOffscreen ? 'true' : 'false'
      if (isOffscreen) {
        linksWrapper.setAttribute('inert', '')
      } else {
        linksWrapper.removeAttribute('inert')
      }
    }
  }

  function setMenuIconOpenState(isOpen: boolean) {
    if (menuIcon instanceof HTMLElement) {
      menuIcon.dataset.open = isOpen ? 'true' : 'false'
    }
    if (navToggle instanceof HTMLElement) {
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    }
  }

  function handleMobileNavToggle() {
    const isCurrentlyOffscreen =
      linksWrapper instanceof HTMLElement &&
      linksWrapper.dataset.offscreen === 'true'
    const opening = isCurrentlyOffscreen
    setOffscreenState(!opening)
    setMenuIconOpenState(opening)

    if (opening && linksWrapper) {
      const firstFocusable = linksWrapper.querySelector<HTMLElement>(
        'a, button, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }
  }

  function handleNavDisplayStyles(event: MediaQueryListEvent) {
    if (event.matches) {
      setOffscreenState(false)
      setMenuIconOpenState(false)
    } else {
      if (linksWrapper) {
        flashPrevention(linksWrapper)
      }
      setOffscreenState(true)
      setMenuIconOpenState(false)
    }
  }

  const wideNavMinWidth = window.matchMedia('(min-width: 1200px)')
  wideNavMinWidth.addEventListener('change', handleNavDisplayStyles)

  // On initial load at wide viewport, remove inert so the nav is reachable by keyboard.
  if (wideNavMinWidth.matches) {
    setOffscreenState(false)
  }

  if (navToggle) {
    navToggle.addEventListener('click', handleMobileNavToggle, false)
  }

  // Escape closes the mobile nav drawer when focus is inside it.
  // Bound to root (not document) so it's naturally scoped and won't duplicate on re-init.
  root.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      !wideNavMinWidth.matches &&
      linksWrapper?.dataset.offscreen === 'false'
    ) {
      setOffscreenState(true)
      setMenuIconOpenState(false)
      navToggle?.focus()
    }
  })

  // Click outside closes the mobile nav drawer.
  document.addEventListener('click', (event) => {
    if (
      !wideNavMinWidth.matches &&
      linksWrapper?.dataset.offscreen === 'false' &&
      !root.contains(event.target as Node)
    ) {
      setOffscreenState(true)
      setMenuIconOpenState(false)
    }
  })

  initSubmenuToggle(root)
}

/**
 * Marks the single best-matching nav link as active based on current path.
 * Uses longest-prefix-match so /a/b/c activates /a/b/c before /a/b.
 * Must be called after the nav is in the DOM.
 */
// Called once on page load; does not handle client-side navigation.
export function markActiveNavLink(root: HTMLElement) {
  const currentPath = window.location.pathname.replace(/\/$/, '')
  const navLinks = Array.from(
    root.querySelectorAll<HTMLAnchorElement>('[data-nav-list] a')
  )

  let bestMatch: HTMLAnchorElement | null = null
  let bestMatchLength = 0

  for (const link of navLinks) {
    const linkPath = link.pathname.replace(/\/$/, '')
    // Skip the root path — the home link shouldn't activate from every subpage.
    if (linkPath === '' || linkPath === '/') continue
    if (currentPath === linkPath || currentPath.startsWith(linkPath + '/')) {
      if (linkPath.length > bestMatchLength) {
        bestMatch = link
        bestMatchLength = linkPath.length
      }
    }
  }

  if (bestMatch) {
    bestMatch.setAttribute('data-active', 'true')
    bestMatch.setAttribute('aria-current', 'page')
    const parentMenu = bestMatch.closest("[data-menu-level='1']")
    parentMenu?.querySelector('button')?.setAttribute('data-active', 'true')
  }
}

function flashPrevention(element: Element) {
  element.setAttribute('style', 'display:none')
  setTimeout(() => {
    element.removeAttribute('style')
  }, 10)
}

function isClickOutside(
  event: MouseEvent,
  nodeList: NodeListOf<Element>
): boolean {
  const eventTarget = event.target as Element
  return !Array.from(nodeList).some((element) => element.contains(eventTarget))
}

/** Sets up submenu button toggling, Escape key, and click-outside closing. */
function initSubmenuToggle(root: HTMLElement) {
  const navList = root.querySelector<HTMLElement>('[data-nav-list]')

  if (!navList) return

  const submenuButtons = root.querySelectorAll<HTMLElement>(
    '[data-submenu-button]'
  )
  const menuItems = root.querySelectorAll<HTMLElement>('[data-menu-level="1"]')
  const wideNav = window.matchMedia('(min-width: 1200px)')

  function getPanel(btn: HTMLElement): HTMLElement | null {
    const id = btn.getAttribute('aria-controls')
    return id ? root.querySelector<HTMLElement>(`#${id}`) : null
  }

  // On mobile, inert closed panels so children aren't tabbable.
  // On desktop, CSS visibility:hidden handles this.
  function syncPanelInert(btn: HTMLElement) {
    const panel = getPanel(btn)
    if (!panel) return
    const isOpen = btn.getAttribute('data-open') === 'true'
    if (!wideNav.matches && !isOpen) {
      panel.setAttribute('inert', '')
    } else {
      panel.removeAttribute('inert')
    }
  }

  function syncAllPanelInert() {
    submenuButtons.forEach(syncPanelInert)
  }

  syncAllPanelInert()
  wideNav.addEventListener('change', syncAllPanelInert)

  submenuButtons.forEach((submenuButton) => {
    submenuButton.setAttribute('aria-expanded', 'false')
    submenuButton.setAttribute('data-open', 'false')

    submenuButton.addEventListener('click', function (event) {
      const clickedButton = event.currentTarget as HTMLElement
      const otherButtons = Array.from(submenuButtons).filter(
        (btn) => btn !== clickedButton
      )

      otherButtons.forEach((btn) => {
        btn.setAttribute('aria-expanded', 'false')
        btn.setAttribute('data-open', 'false')
        syncPanelInert(btn)
      })

      const isOpen = clickedButton.getAttribute('aria-expanded') === 'true'
      clickedButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true')
      clickedButton.setAttribute('data-open', isOpen ? 'false' : 'true')
      syncPanelInert(clickedButton)
    })
  })

  // Close a submenu when focus leaves its menu group (Tab-out on desktop).
  menuItems.forEach((menuItem) => {
    menuItem.addEventListener('focusout', (event) => {
      const relatedTarget = (event as FocusEvent).relatedTarget as Node | null
      if (!relatedTarget || !menuItem.contains(relatedTarget)) {
        const btn = menuItem.querySelector<HTMLElement>('[data-submenu-button]')
        if (btn) {
          btn.setAttribute('aria-expanded', 'false')
          btn.setAttribute('data-open', 'false')
          syncPanelInert(btn)
        }
      }
    })
  })

  navList.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      const openButton = Array.from(submenuButtons).find(
        (btn) => btn.getAttribute('data-open') === 'true'
      )
      openButton?.focus()
      resetSubMenus()
    }
  })

  document.addEventListener('click', function (event) {
    if (isClickOutside(event, submenuButtons)) {
      resetSubMenus()
    }
  })

  function resetSubMenus() {
    submenuButtons.forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false')
      btn.setAttribute('data-open', 'false')
      syncPanelInert(btn)
    })
  }
}
