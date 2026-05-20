import { initHeaderNav, markActiveNavLink } from '@/scripts/header-nav'

const navId = 'block-interledger-mainnavigation'
const headerRoot = document.getElementById(navId)
if (headerRoot) {
  initHeaderNav(navId, 'foundationMenuIcon')
  markActiveNavLink(headerRoot)
}

// Switch from dark to light after scrolling past all dark sections.
// Only activates on pages that start dark (e.g. homepage) and have a hero.
const header = document.querySelector<HTMLElement>('.foundation-header')
const darkSections = [
  document.querySelector('[data-component="HomepageHero"]'),
  ...Array.from(document.querySelectorAll('[data-nav-dark]')),
].filter(Boolean) as Element[]

if (header && darkSections.length > 0 && header.dataset.theme === 'dark') {
  const intersecting = new Set<Element>()

  const updateTheme = () => {
    // Keep dark at the page top — the observer can fire before layout with
    // isIntersecting=false, which briefly flipped the bar to light.
    const atPageTop = window.scrollY <= 0
    header.dataset.theme =
      intersecting.size > 0 || atPageTop ? 'dark' : 'light'
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          intersecting.add(entry.target)
        } else {
          intersecting.delete(entry.target)
        }
      }
      updateTheme()
    },
    { threshold: 0 }
  )

  darkSections.forEach((el) => observer.observe(el))

  // Background cross-fade only after the user scrolls — avoids a load-time flash.
  window.addEventListener(
    'scroll',
    () => {
      header.dataset.themeAnimate = 'true'
    },
    { once: true, passive: true }
  )
}
