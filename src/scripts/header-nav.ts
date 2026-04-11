/**
 * Shared header navigation behavior.
 * Used by both Summit and Foundation headers.
 */

/** Sets up mobile nav toggle, responsive breakpoint handling, and submenu behavior. */
export function initHeaderNav(iconId: string, rootSelector: string) {
  const root = document.querySelector<HTMLElement>(rootSelector)
  if (!root) return

  const linksWrapper = root.querySelector<HTMLElement>('[data-nav-wrapper]')
  const menuIcon = root.querySelector<HTMLElement>(`#${iconId}`)
  const navToggle = root.querySelector<HTMLElement>('[data-nav-toggle]')

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
        suppressTransitionFlash(linksWrapper)
      }
      setOffscreenState(true)
      setMenuIconOpenState(false)
    }
  }

  const wideNavMinWidth = window.matchMedia('(min-width: 1060px)')
  wideNavMinWidth.addEventListener('change', handleNavDisplayStyles)

  if (navToggle) {
    navToggle.addEventListener('click', handleMobileNavToggle, false)
  }

  initSubmenuToggle(root)
}

function suppressTransitionFlash(element: HTMLElement) {
  const previousTransition = element.style.transition

  element.style.transition = 'none'
  // Force style recalculation so the transition suppression is applied.
  void element.offsetHeight

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (previousTransition) {
        element.style.transition = previousTransition
      } else {
        element.style.removeProperty('transition')
      }
    })
  })
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

  if (!navList || !document.contains(navList)) return

  const submenuButtons = root.querySelectorAll<HTMLElement>(
    '[data-submenu-button]'
  )

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
      })

      const isOpen = clickedButton.getAttribute('aria-expanded') === 'true'
      clickedButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true')
      clickedButton.setAttribute('data-open', isOpen ? 'false' : 'true')
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
