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
  const observer = new IntersectionObserver(
    ([entry]) => {
      header.dataset.theme = entry.isIntersecting ? 'dark' : 'light'
    },
    { threshold: 0 }
  )
  observer.observe(hero)
}
