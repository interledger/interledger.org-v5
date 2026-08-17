import { initHeaderNav, markActiveNavLink } from '@/scripts/header-nav'

const navId = 'block-hackathon-navigation'
const headerRoot = document.getElementById(navId)
if (headerRoot) {
  initHeaderNav(navId, 'hackathonMenuIcon')
  markActiveNavLink(headerRoot)
}
