// This barrel re-exports utilities from the three lane buckets:
//   shared/: pure helpers safe on either side of the docs/main-site boundary
//   main/:   anything coupled to main-site routing, content collections, or i18 chains
//   docs/:   Starlight-only helpers
// Lane structure exists to keep the JS module graph from leaking Tailwind CSS
// into Starlight chunks (see src/styles/README.md "Starlight Docs Isolation").

// Shared (safe on either side)
export {
  stripTrailingSlash,
  addTrailingSlash,
  ensureAbsoluteUrl,
  getSocialIconName,
  FALLBACK_SOCIAL_ICON,
  type SocialIconName
} from './shared/url'
export { tryCatchAsync } from './shared/tryCatch'
export { twMerge } from './shared/twMerge'
export { getVisiblePages } from './shared/pagination'

// Main site: URL & routing
export {
  type RouteCollection,
  HOME_CONTENT_SLUG,
  ROUTE_BASES,
  normalizeBasePath,
  localizeRoute
} from './main/routes'
export { routeContextFromPathname } from './main/routeContext'
export { default as stripPagination } from './main/stripPagination'

// Main site: Internationalisation
export {
  type Locale,
  type UiKey,
  locales,
  defaultLocale,
  switcherLocales,
  useTranslations,
  translatePath,
  COLLECTION_INDEX_SLUG,
  buildRoutePath
} from './main/i18'
export {
  getAlternateLocale,
  getAlternateLocaleHref,
  getLanguageSwitcherHrefs
} from './main/languageSwitcherHrefs'
export { buildMap } from './main/translationMap'
export { translationMap } from './main/translationMapData'

// Main site: Data fetching
export { getNavigation } from './main/navigation'
export { fetchStrapi, type StrapiResponse } from './main/fetchStrapi'
export { applyPreviewNoStore } from './main/cache'

// Main site: Static paths
export { CONTENT, CONTENT_ROOT } from './main/contentCollections'
export {
  type CollectionType,
  type SiteSection,
  /** @deprecated Use {@link SiteSection} instead — kept for existing imports. */
  type ProfileSection,
  getLocalizedPaths,
  getCrossSectionPaths
} from './main/static-paths'
export {
  type BreadcrumbItem,
  buildSectionEntryBreadcrumbs
} from './main/breadcrumbs'
export {
  type BlogTaxonomy,
  getBlogTaxonomy,
  getTermSlug,
  getTermUrl,
  translateTerm,
  buildContentLangHrefs,
  paginateAllPosts,
  paginatePostsByTerm
} from './main/tagFilter'
export {
  FEATURED_POST_LIMIT,
  TECH_BLOG_FALLBACK_THUMBNAIL,
  getFeaturedPosts,
  getBlogThumbnail,
  getReadingTime
} from './main/blog'

// Main site: Text
export { generateSlug } from './main/slug'
export { truncateText } from './main/text'
export { parseMarkdown, parseMarkdownInline } from './main/mdx'
export { getTableScrollAriaLabel } from './main/getTableScrollAriaLabel'
export {
  TABLE_SCROLL_CLASS,
  wrapScrollableTables
} from './main/wrapScrollableTables'
export { createExcerpt } from './main/create-excerpt'

// Main site: Formatting
export { formatDateTime, formatDate, getDurationInMinutes } from './main/time'

// Main site: Media & UI
export { detectVideoProvider } from './main/video'
export { getHeroSectionStyle } from './main/heroSectionStyle'

// Main site: Summit
export { sessionizeApiMap, YEARS, currentSummitYear } from './main/sessionize'
export {
  getSpeakers,
  getTalks,
  getTalkPreviews
} from './main/extractSessionize'
export {
  getTranslation,
  paginateSummitTalks,
  paginateSummitSpeakers,
  getSpeakerPages,
  getSessionPages
} from './main/summit-talks-speakers'

// Main site: Images
export {
  getOptimizedImage,
  buildImageSrcset,
  hasOptimizedVariants,
  IMAGE_URL_PATHS,
  TARGET_WIDTHS,
  pathToSegments,
  type OptimizedImage
} from './main/images'

// Main site: Profiles
export {
  toProfileData,
  getProfileColorIndex,
  getProfileColorIndexMap
} from './main/profiles'

// Main site: Analytics
export {
  type UmamiAttrs,
  type UmamiContext,
  type UmamiSection,
  type BuildUmamiAttrsInput,
  buildUmamiAttrs,
  deriveAction,
  deriveLabel,
  derivePage,
  escapeHtml,
  umamiAttrsToHtml
} from './main/umami'

// Main site: SEO
export {
  buildCanonicalMeta,
  type CanonicalMeta,
  type HreflangMeta
} from './main/seoMeta'

// Main site: Roadmap (developers tech roadmap timeline)
export {
  createPositioner,
  type TimelinePositioner
} from './main/roadmap/timeline'
export {
  monthStart,
  monthEnd,
  computeDateRange,
  roadmapWindow,
  projectOverlapsWindow,
  clampRangeToWindow
} from './main/roadmap/dateRange'
export {
  buildMonths,
  buildQuarterHeaders,
  type MonthEntry,
  type QuarterHeader
} from './main/roadmap/grid'
export { buildGridItems, type GridItem } from './main/roadmap/grouping'
export {
  computeProjectBarProps,
  type ProjectBarProps
} from './main/roadmap/projectBar'
export { resolveIcon } from './main/roadmap/icons'
export { loadDevSnapshot } from './main/roadmap/devSnapshot'
