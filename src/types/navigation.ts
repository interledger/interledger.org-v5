export interface MenuItem {
  label: string
  href?: string
  openInNewTab?: boolean
}

export interface MenuSubGroup {
  label: string
  items: MenuItem[]
}

interface MenuGroupBase {
  label: string
}

/** Top-level entry that is the link itself. No children. */
export interface MenuLinkGroup extends MenuGroupBase {
  href: string
  items?: undefined
  subGroups?: undefined
}

/** Top-level entry that opens a panel. No href of its own. */
export interface MenuParentGroup extends MenuGroupBase {
  href?: undefined
  items?: MenuItem[]
  subGroups?: MenuSubGroup[]
}

/**
 * A group is a link or a parent, never both. The old microsite menu kept an
 * href and ignored children. This menu would drop the href and show a button.
 * The nav JSON is cast to this type, so navigation.test.ts checks the files.
 */
export type MenuGroup = MenuLinkGroup | MenuParentGroup

export interface NavigationData {
  mainMenu: MenuGroup[]
  ctaButton?: MenuItem
}

/** Sites with their own navigation config, one JSON file per site per locale. */
export type NavigationSite = 'foundation' | 'summit' | 'hackathon'

/** Sites that set `Astro.locals.site`. Summit uses foundation chrome; the flag stays so blocks can tell the page from foundation. */
export type MicrositeSite = Extract<NavigationSite, 'summit'>
