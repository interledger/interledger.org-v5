import { initHeaderNav, markActiveNavLink } from '@/scripts/header-nav'

const navId = 'block-summit-navigation'
const headerRoot = document.getElementById(navId)
if (headerRoot) {
  initHeaderNav(navId, 'summitMenuIcon')
  markActiveNavLink(headerRoot)
}
