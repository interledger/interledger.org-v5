import { initHeaderNav, markActiveNavLink } from '@/scripts/header-nav'

const navId = 'block-microsite-navigation'
const headerRoot = document.getElementById(navId)
if (headerRoot) {
  initHeaderNav(navId, 'micrositeMenuIcon')
  markActiveNavLink(headerRoot)
}
