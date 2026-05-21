export interface MenuItem {
  label: string
  href?: string
  openInNewTab?: boolean
}

export interface MenuSubGroup {
  label: string
  items: MenuItem[]
}

export interface MenuGroup {
  label: string
  href?: string
  items?: MenuItem[]
  subGroups?: MenuSubGroup[]
}

export interface NavigationData {
  mainMenu: MenuGroup[]
  ctaButton?: MenuItem
}
