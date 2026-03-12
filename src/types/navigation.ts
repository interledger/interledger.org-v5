export interface MenuItem {
  label: string
  href?: string
  openInNewTab?: boolean
}

export interface MenuGroup {
  label: string
  href?: string
  items?: MenuItem[]
}
