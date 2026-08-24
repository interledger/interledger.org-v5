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
  ensureLeadingSlash,
  hasUrlScheme,
  ensureAbsoluteUrl,
  isSafeMarkdownHref,
  isExternalHref,
  getHostname,
  getSocialIconName,
  FALLBACK_SOCIAL_ICON,
  type SocialIconName
} from './shared/url'
export { tryCatchAsync } from './shared/tryCatch'
export { twMerge } from './shared/twMerge'
export { getVisiblePages } from './shared/pagination'
export {
  parseStatNumber,
  formatStatNumber,
  buildNumberTileAriaLabel
} from './shared/parseStatNumber'
export {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_SIZE_LABEL,
  formatFileSize,
  imageOverSizeLimitError,
  imageSizeLimitError,
  isImageOverSizeLimit
} from './shared/uploadLimits'

// Main site: URL & routing
export {
  type RouteCollection,
  HOME_CONTENT_SLUG,
  HACKATHON_HOME_SLUG,
  GRANT_OVERVIEW_PRIMARY_SLUG,
  GRANT_GRANTEE_DIRECTORY_SLUG,
  PODCAST_PAGE_SLUG,
  ROUTE_BASES,
  grantOverviewRouteParam,
  grantOverviewHubPath,
  grantGranteeDirectoryPath,
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
  buildRoutePath,
  getBlogPostPath
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
export { getSectionPageLayout } from './main/sectionLayout'
export {
  type TermTaxonomy,
  type TaxonomyCollection,
  getTaxonomy,
  getTermSlug,
  getTermUrl,
  translateTerm,
  buildContentLangHrefs,
  paginateAllPosts,
  paginatePostsByTerm,
  ALL_TERM_SLUG,
  CATEGORY_SEGMENT
} from './main/tagFilter'
export {
  FEATURED_POST_LIMIT,
  TECH_BLOG_FALLBACK_THUMBNAIL,
  getFeaturedPosts,
  getBlogThumbnail,
  getReadingTime,
  resolveRelatedPosts
} from './main/blog'
export {
  PODCAST_PAGE_SIZE,
  type PodcastPageData,
  paginatePodcastEpisodes,
  paginatePodcastEpisodesByTerm
} from './main/podcastPagination'
export {
  GRANTEE_PAGE_SIZE,
  ALL_GRANTEE_YEAR_SLUG,
  getGranteeFilterUrl,
  getGranteeListingData,
  paginateGranteesByYear,
  paginateGranteesByYearAndTag,
  parseGranteeRecords,
  uniqueFilterOptions,
  matchesGranteeFilters,
  filterGrantees,
  normalizeCountry,
  formatBudgetAmount,
  formatStartMonth,
  type Grantee,
  type GranteeFilters,
  type GranteeFilterOption,
  type GranteeListingData
} from './main/grantee'

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
export {
  resolveCtaLink,
  resolveDownloadName,
  type CtaIconName,
  type CtaLinkInput,
  type ResolvedCtaLink
} from './main/cta'

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
  isOptimizableSource,
  encodeImageUrlPath,
  hasOptimizableRasterExtension,
  withIntrinsicWidthRung,
  IMAGE_URL_PATHS,
  TARGET_WIDTHS,
  pathToSegments,
  type OptimizedImage
} from './main/images'
export {
  NETLIFY_IMAGE_ENDPOINT,
  buildImageCdnUrl,
  buildImageCdnVariants,
  imageCdnEnabled,
  isImageCdnEnabled,
  type ImageCdnFormat
} from './main/imageCdn'

// Main site: Profiles
export {
  toProfileData,
  getProfileColorIndex,
  getProfileColorIndexMap
} from './main/profiles'

// Main site: Analytics
export {
  type UmamiLabel,
  type UmamiAttrs,
  type UmamiSection,
  type UmamiDestinationSection,
  type UmamiTrackAttrs,
  type BuildUmamiAttrsInput,
  buildDeferredUmamiAttrs,
  buildUmamiAttrs,
  buildSubmenuToggleUmamiAttrs,
  buildSessionCardUmamiAttrs,
  buildNavLinkUmamiAttrs,
  buildNavCtaUmamiAttrs,
  buildSectionNavLinkUmamiAttrs,
  escapeHtml,
  umamiAttrsToHtml
} from './main/umami'

// Main site: SEO
export {
  buildCanonicalMeta,
  type CanonicalMeta,
  type HreflangMeta
} from './main/seoMeta'
export {
  isDemoPathSlug,
  isDemoPathname,
  isPreviewPathname
} from './shared/demoPaths'

// Main site: Footer
export {
  socialLinks,
  type SocialLink,
  getFooterOnlyColumn
} from './main/footer'

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
