import { defaultLocale, type Locale } from '@/utils/i18'

import foundationEn from '@/config/foundation-navigation.en.json'
import foundationEs from '@/config/foundation-navigation.es.json'
import summitEn from '@/config/summit-navigation.en.json'
import summitEs from '@/config/summit-navigation.es.json'

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

export interface NavigationData {
  mainMenu: MenuGroup[]
  ctaButton?: MenuItem
}

const navigationMap: Record<string, Record<string, NavigationData>> = {
  foundation: {
    en: foundationEn as NavigationData,
    es: foundationEs as NavigationData
  },
  summit: {
    en: summitEn as NavigationData,
    es: summitEs as NavigationData
  }
}

export function getNavigation(
  site: 'foundation' | 'summit',
  locale: Locale
): NavigationData {
  const siteMap = navigationMap[site]
  return siteMap[locale] ?? siteMap[defaultLocale]
}
