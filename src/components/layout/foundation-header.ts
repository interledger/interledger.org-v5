import { initHeaderNav, markActiveNavLink } from '@/scripts/header-nav'

const navId = 'block-interledger-mainnavigation'
const headerRoot = document.getElementById(navId)
if (headerRoot) {
  initHeaderNav(navId, 'foundationMenuIcon')
  markActiveNavLink(headerRoot)
}

// Switch from dark to light after scrolling past the hero.
// Only activates on pages that start dark (e.g. homepage) and have a hero.
const header = document.querySelector<HTMLElement>('.foundation-header')
const hero = document.querySelector('[data-component="HomepageHero"]')

if (header && hero && header.dataset.theme === 'dark') {
  const updateTheme = (entry: IntersectionObserverEntry) => {
    // Keep dark at the page top — the observer can fire before layout with
    // isIntersecting=false, which briefly flipped the bar to light (grey).
    const atPageTop = window.scrollY <= 0
    header.dataset.theme = entry.isIntersecting || atPageTop ? 'dark' : 'light'
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry) updateTheme(entry)
    },
    { threshold: 0 }
  )
  observer.observe(hero)

  // Background cross-fade only after the user scrolls — avoids a load-time flash.
  window.addEventListener(
    'scroll',
    () => {
      header.dataset.themeAnimate = 'true'
    },
    { once: true, passive: true }
  )
}
