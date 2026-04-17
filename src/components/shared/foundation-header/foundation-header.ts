import { initHeaderNav, markActiveNavLink } from '@/scripts/header-nav'

const navId = 'block-interledger-mainnavigation'
const headerRoot = document.getElementById(navId)
if (headerRoot) {
  initHeaderNav(navId, 'foundationMenuIcon')
  markActiveNavLink(headerRoot)
}
