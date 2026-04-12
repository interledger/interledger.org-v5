// URL & routing
export { stripTrailingSlash } from './url'
export { type RouteCollection, HOME_SLUG, ROUTE_BASES, normalizeBasePath, localizeRoute } from './routes'
export { type RouteContext, routeContextFromPathname } from './routeContext'
export { default as stripPagination } from './stripPagination'

// Internationalisation
export { type Locale, locales, localeSchema, defaultLocale, switcherLocales } from './i18'
export { type TranslationEntry, buildMap } from './translationMap'
export { translationMap } from './translationMapData'

// Data fetching
export { fetchStrapi } from './fetchStrapi'
export { CACHE_CONTROL, applyPreviewNoStore } from './cache'

// Static paths
export { type CollectionType, getLocalizedPaths } from './static-paths'
export { getTagSlug, getTagUrl, paginateAllPosts, paginatePostsByTag } from './tagFilter'

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
export { getTranslation, paginateSummitTalks, paginateSummitSpeakers, getSpeakerPages, getSessionPages } from './summit-talks-speakers'
