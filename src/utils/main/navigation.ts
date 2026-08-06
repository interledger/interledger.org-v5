import { defaultLocale, type Locale } from './locales'

import foundationEn from '@/config/foundation-navigation.json'
import foundationEs from '@/config/foundation-navigation.es.json'
import summitEn from '@/config/summit-navigation.json'
import summitEs from '@/config/summit-navigation.es.json'
import hackathonEn from '@/config/hackathon-navigation.json'
import hackathonEs from '@/config/hackathon-navigation.es.json'
import type { NavigationData, NavigationSite } from '@/types/navigation'

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
