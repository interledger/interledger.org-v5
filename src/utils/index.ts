// URL & routing
export { stripTrailingSlash, addTrailingSlash } from './url'
export {
  type RouteCollection,
  HOME_CONTENT_SLUG,
  ROUTE_BASES,
  normalizeBasePath,
  localizeRoute
} from './routes'
export { routeContextFromPathname } from './routeContext'
export { default as stripPagination } from './stripPagination'

// Internationalisation
export {
  type Locale,
  locales,
  defaultLocale,
  switcherLocales,
  useTranslations,
  translatePath,
  COLLECTION_INDEX_SLUG,
  buildRoutePath
} from './i18'
export { buildMap } from './translationMap'
export { translationMap } from './translationMapData'

// Data fetching
export { getNavigation } from './navigation'
export { fetchStrapi } from './fetchStrapi'
export { applyPreviewNoStore } from './cache'

// Static paths
export { CONTENT, CONTENT_ROOT } from './contentCollections'
export { type CollectionType, getLocalizedPaths } from './static-paths'
export {
  getTagSlug,
  getTagUrl,
  translateTag,
  paginateAllPosts,
  paginatePostsByTag
} from './tagFilter'

// Text
export { generateSlug } from './slug'
export { truncateText } from './text'
export { parseMarkdown, parseMarkdownInline } from './mdx'
export { createExcerpt } from './create-excerpt'

// Formatting
export { formatDate, getDurationInMinutes } from './time'

// Media & UI
export { detectVideoProvider } from './video'
export { getHeroSectionStyle } from './heroSectionStyle'

// Summit
export { sessionizeApiMap, YEARS, currentSummitYear } from './sessionize'
export { getSpeakers, getTalks, getTalkPreviews } from './extractSessionize'
export {
  getTranslation,
  paginateSummitTalks,
  paginateSummitSpeakers,
  getSpeakerPages,
  getSessionPages
} from './summit-talks-speakers'

// Images
export { getOptimizedImage } from './images'

// Ambassadors
export { toAmbassadorData } from './ambassadors'

// GitHub
export { parseRawGitHubPath } from './parseRawGitHubPath'

// Analytics
export {
  type UmamiAttrs,
  type UmamiContext,
  type UmamiSection,
  buildUmamiAttrs,
  deriveAction,
  deriveLabel,
  derivePage
} from './umami'

// SEO
export {
  buildCanonicalMeta,
  type CanonicalMeta,
  type HreflangMeta
} from './seoMeta'
