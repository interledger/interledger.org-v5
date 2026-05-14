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
  /** Nested sub-sections. Footer renders them inline; header renders them as a multi-column mega menu when present (falls back to `items` otherwise). */
  subGroups?: MenuSubGroup[]
}

export interface NavigationData {
  mainMenu: MenuGroup[]
  ctaButton?: MenuItem
}
