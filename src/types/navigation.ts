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
  /** Nested sub-sections rendered in the footer nav; ignored by the header. */
  subGroups?: MenuSubGroup[]
}

export interface NavigationData {
  mainMenu: MenuGroup[]
  ctaButton?: MenuItem
}
