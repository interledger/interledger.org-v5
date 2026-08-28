/**
 * Shared header navigation behavior.
 * Used by the Foundation, Summit, and Hackathon headers.
 *
 * All DOM queries are scoped to the nav root identified by `navId`,
 * so multiple headers on the same page won't interfere with each other.
 */

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string>) => void }
  }
}

const TRACK_EVENT_ATTR = 'data-track-event'
const TRACK_PROP_ATTR_RE = /^data-track-event-(.+)$/

// initHeaderNav runs once per header on the page (Foundation, Summit, and
// Hackathon headers all call it), but the click-tracking listener is page-global —
// this guard keeps a second header init from registering it twice and
// double-firing window.umami.track() on every click.
let navClickTrackingInitialized = false

/**
 * Fires the same Umami event nav links would otherwise get from their
 * `data-umami-event*` attributes, but via `window.umami.track()` instead of
 * Umami's own click-intercepting listener — see `buildDeferredUmamiAttrs`
 * (`src/utils/main/umami.ts`) for why. Native navigation is never blocked.
 */
function initNavClickTracking() {
  if (navClickTrackingInitialized) return
  navClickTrackingInitialized = true

  document.addEventListener('click', (event) => {
    const target = event.target as Element | null
    const trackedEl = target?.closest(`[${TRACK_EVENT_ATTR}]`)
    if (!trackedEl) return

    const eventName = trackedEl.getAttribute(TRACK_EVENT_ATTR)
    if (!eventName) return

    const data: Record<string, string> = {}
    for (const attrName of trackedEl.getAttributeNames()) {
      const match = attrName.match(TRACK_PROP_ATTR_RE)
      if (!match) continue
      const value = trackedEl.getAttribute(attrName)
      if (value) data[match[1]] = value
    }

    window.umami?.track(eventName, data)
  })
}

/** Sets up mobile nav toggle, responsive breakpoint handling, and submenu behavior. */
export function initHeaderNav(navId: string, iconId: string) {
  const root = document.getElementById(navId)
  if (!root) return

  initNavClickTracking()

  const linksWrapper = root.querySelector<HTMLElement>('[data-nav-wrapper]')
  const menuIcon = document.getElementById(iconId)
  const navToggle = root.querySelector<HTMLElement>('[data-nav-toggle]')

  function setOffscreenState(isOffscreen: boolean) {
    if (linksWrapper instanceof HTMLElement) {
      linksWrapper.dataset.offscreen = isOffscreen ? 'true' : 'false'
      // inert is applied by JS only — not in the HTML template — so desktop
      // nav stays keyboard-accessible when JS fails to load. Mobile drawer
      // toggle still requires JS; closed drawer uses visibility:hidden via CSS.
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

  // Sync drawer + inert to viewport on load (markup defaults to mobile-closed).
  if (wideNavMinWidth.matches) {
    setOffscreenState(false)
  } else {
    setOffscreenState(true)
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

/** Reads a layout property so the next style change starts a new transition. */
function forceReflow(element: HTMLElement) {
  void element.offsetHeight
}

/** State a drawer submenu panel is in when its height is recalculated. */
export interface PanelHeightState {
  /** True on the desktop breakpoint, where CSS positions the panel instead. */
  isWideNav: boolean
  isOpen: boolean
  /** The panel's current inline `max-height`, `''` when none is set. */
  inlineMaxHeight: string
  /** The panel's `scrollHeight`. */
  contentHeight: number
}

/**
 * The inline `max-height` values to apply, in order, with a reflow between each.
 *
 * An open panel is capped at its own content height, never at a viewport
 * height: a viewport cap clipped the taller mega menus with no way to reach the
 * rest of the list. The cap is then dropped by the caller once the reveal
 * finishes, so later reflow can still grow the panel.
 */
export function panelMaxHeightSteps(state: PanelHeightState): string[] {
  // Desktop drops the inline cap and lets the CSS dropdown rules take over.
  if (state.isWideNav) return ['']

  if (state.isOpen) return [`${state.contentHeight}px`]

  // An uncapped panel needs a pixel height again before it can animate shut.
  if (state.inlineMaxHeight === 'none') {
    return [`${state.contentHeight}px`, '0px']
  }

  return ['0px']
}

// Longer than the 500ms panel transition, so the fallback only fires when no
// transition ran at all (reduced motion, or a panel with no height change).
const PANEL_TRANSITION_TIMEOUT_MS = 700

/** Runs `done` once the panel's max-height transition settles, or times out. */
function afterMaxHeightTransition(panel: HTMLElement, done: () => void) {
  let settled = false
  let timer = 0

  const settle = () => {
    if (settled) return
    settled = true
    panel.removeEventListener('transitionend', onTransitionEnd)
    window.clearTimeout(timer)
    done()
  }

  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.target === panel && event.propertyName === 'max-height') settle()
  }

  panel.addEventListener('transitionend', onTransitionEnd)
  timer = window.setTimeout(settle, PANEL_TRANSITION_TIMEOUT_MS)
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

  function isOpen(btn: HTMLElement) {
    return btn.getAttribute('data-open') === 'true'
  }

  // On mobile, inert closed panels so children aren't tabbable.
  // On desktop, CSS visibility:hidden handles this.
  function syncPanelInert(btn: HTMLElement) {
    const panel = getPanel(btn)
    if (!panel) return
    if (!wideNav.matches && !isOpen(btn)) {
      panel.setAttribute('inert', '')
    } else {
      panel.removeAttribute('inert')
    }
  }

  /**
   * Applies the drawer accordion's `max-height`, then uncaps an open panel once
   * the reveal finishes so later reflow (zoom, rotation, a font swap) can grow
   * it and the drawer scrolls to all of it.
   */
  function syncPanelHeight(btn: HTMLElement) {
    const panel = getPanel(btn)
    if (!panel) return

    const steps = panelMaxHeightSteps({
      isWideNav: wideNav.matches,
      isOpen: isOpen(btn),
      inlineMaxHeight: panel.style.maxHeight,
      contentHeight: panel.scrollHeight
    })

    steps.forEach((maxHeight, index) => {
      if (index > 0) forceReflow(panel)
      panel.style.maxHeight = maxHeight
    })

    if (!isOpen(btn) || wideNav.matches) return

    afterMaxHeightTransition(panel, () => {
      if (isOpen(btn) && !wideNav.matches) panel.style.maxHeight = 'none'
    })
  }

  function syncPanel(btn: HTMLElement) {
    syncPanelInert(btn)
    syncPanelHeight(btn)
  }

  function closeSubmenu(btn: HTMLElement) {
    btn.setAttribute('aria-expanded', 'false')
    btn.setAttribute('data-open', 'false')
    syncPanel(btn)
  }

  function syncAllPanels() {
    submenuButtons.forEach(syncPanel)
  }

  syncAllPanels()
  wideNav.addEventListener('change', syncAllPanels)

  submenuButtons.forEach((submenuButton) => {
    submenuButton.setAttribute('aria-expanded', 'false')
    submenuButton.setAttribute('data-open', 'false')

    submenuButton.addEventListener('click', function (event) {
      const clickedButton = event.currentTarget as HTMLElement
      const otherButtons = Array.from(submenuButtons).filter(
        (btn) => btn !== clickedButton
      )

      otherButtons.forEach(closeSubmenu)

      const wasOpen = clickedButton.getAttribute('aria-expanded') === 'true'
      clickedButton.setAttribute('aria-expanded', wasOpen ? 'false' : 'true')
      clickedButton.setAttribute('data-open', wasOpen ? 'false' : 'true')
      syncPanel(clickedButton)
    })
  })

  // Close a submenu when focus leaves its menu group (Tab-out on desktop).
  menuItems.forEach((menuItem) => {
    menuItem.addEventListener('focusout', (event) => {
      const relatedTarget = (event as FocusEvent).relatedTarget as Node | null
      if (!relatedTarget || !menuItem.contains(relatedTarget)) {
        const btn = menuItem.querySelector<HTMLElement>('[data-submenu-button]')
        if (btn) closeSubmenu(btn)
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
    submenuButtons.forEach(closeSubmenu)
  }
}
