import { defaultLocale, type Locale } from './i18'

import foundationEn from '@/config/foundation-navigation.json'
import foundationEs from '@/config/foundation-navigation.es.json'
import summitEn from '@/config/summit-navigation.json'
import summitEs from '@/config/summit-navigation.es.json'
import type { NavigationData } from '@/types/navigation'

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
