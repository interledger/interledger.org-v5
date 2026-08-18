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

/** Sites with their own navigation config, one JSON file per site per locale. */
export type NavigationSite = 'foundation' | 'summit' | 'hackathon'

/** Summit uses the microsite chrome (dark header/footer over BaseLayout). */
export type MicrositeSite = Extract<NavigationSite, 'summit'>
