import { defaultLocale, type Locale } from './locales'

import foundationEn from '@/config/foundation-navigation.json'
import foundationEs from '@/config/foundation-navigation.es.json'
import summitEn from '@/config/summit-navigation.json'
import summitEs from '@/config/summit-navigation.es.json'
import hackathonEn from '@/config/hackathon-navigation.json'
import hackathonEs from '@/config/hackathon-navigation.es.json'
import type {
  MenuGroup,
  MenuLinkGroup,
  NavigationData,
  NavigationSite
} from '@/types/navigation'

const navigationMap: Record<NavigationSite, Record<string, NavigationData>> = {
  foundation: {
    en: foundationEn as NavigationData,
    es: foundationEs as NavigationData
  },
  summit: {
    en: summitEn as NavigationData,
    es: summitEs as NavigationData
  },
  hackathon: {
    en: hackathonEn as NavigationData,
    es: hackathonEs as NavigationData
  }
}

export function getNavigation(
  site: NavigationSite,
  locale: Locale
): NavigationData {
  const siteMap = navigationMap[site]
  return siteMap[locale] ?? siteMap[defaultLocale]
}

/**
 * A top-level entry that is itself the link, such as Summit's Code of conduct.
 * Children make it a button. Href and children together are not a MenuGroup.
 */
export function isDirectNavLink(group: MenuGroup): group is MenuLinkGroup {
  const hasChildren =
    (group.items?.length ?? 0) > 0 || (group.subGroups?.length ?? 0) > 0
  return Boolean(group.href) && !hasChildren
}
