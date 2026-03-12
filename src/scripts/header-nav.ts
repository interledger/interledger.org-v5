/**
 * Shared header navigation behavior.
 * Used by both Summit and Foundation headers.
 */

/** Sets up mobile nav toggle, responsive breakpoint handling, and submenu behavior. */
export function initHeaderNav(iconId: string) {
  const linksWrapper = document.querySelector('[data-nav-wrapper]')
  const menuIcon = document.getElementById(iconId)
  const navToggle = document.querySelector('[data-nav-toggle]')

  function setOffscreenState(isOffscreen: boolean) {
    if (linksWrapper instanceof HTMLElement) {
      linksWrapper.dataset.offscreen = isOffscreen ? 'true' : 'false'
    }
  }

  function setMenuIconOpenState(isOpen: boolean) {
    if (menuIcon instanceof HTMLElement) {
      menuIcon.dataset.open = isOpen ? 'true' : 'false'
    }
  }

  function handleMobileNavToggle() {
    const isCurrentlyOffscreen =
      linksWrapper instanceof HTMLElement &&
      linksWrapper.dataset.offscreen === 'true'
    setOffscreenState(!isCurrentlyOffscreen)
    setMenuIconOpenState(isCurrentlyOffscreen)
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

  const wideNavMinWidth = window.matchMedia('(min-width: 1060px)')
  wideNavMinWidth.addEventListener('change', handleNavDisplayStyles)

  if (document.contains(navToggle)) {
    navToggle?.addEventListener('click', handleMobileNavToggle, false)
  }

  initSubmenuToggle()
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
  return !Array.from(nodeList).some((element) =>
    element.contains(eventTarget)
  )
}

/** Sets up submenu button toggling, Escape key, and click-outside closing. */
function initSubmenuToggle() {
  const navList = document.querySelector('[data-nav-list]') as HTMLElement | null

  if (!navList || !document.contains(navList)) return

  const submenuButtons = document.querySelectorAll('[data-submenu-button]')

  submenuButtons.forEach((submenuButton) => {
    submenuButton.setAttribute('aria-expanded', 'false')
    submenuButton.setAttribute('data-open', 'false')

    submenuButton.addEventListener('click', function (event) {
      const clickedButton = event.target
      const otherButtons = Array.from(submenuButtons).filter(
        (btn) => btn !== clickedButton
      )

      otherButtons.forEach((btn) => {
        btn.setAttribute('aria-expanded', 'false')
        btn.setAttribute('data-open', 'false')
      })

      if (clickedButton instanceof HTMLElement) {
        const isOpen = clickedButton.getAttribute('aria-expanded') === 'true'
        clickedButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true')
        clickedButton.setAttribute('data-open', isOpen ? 'false' : 'true')
      }
    })
  })

  navList.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
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
    })
  }
}
