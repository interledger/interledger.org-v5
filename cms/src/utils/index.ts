// Error handling
export { tryCatchAsync } from './tryCatch'

// Shared content-type shapes
export { type AuthorBio } from './contentTypes'

// Code block
export { CODE_BLOCK_LANGUAGES, type CodeBlockLanguage } from './codeBlock'

// Upload limits (image half mirrored in src/utils/shared/uploadLimits.ts)
export {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_SIZE_LABEL,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_SIZE_LABEL,
  IMAGE_EXTENSIONS,
  formatFileSize,
  imageOverSizeLimitError,
  imageSizeLimitError,
  isImageOverSizeLimit,
  isImagePath,
  isMediaOverSizeLimit,
  mediaSizeLimitError
} from './uploadLimits'

// API token authorization (routes registered outside Strapi's middleware)
export { extractBearerToken, isFullAccessApiToken } from './apiTokenAuth'

// Disk → Media Library seeding (bootstrap + sync:images)
export { SEED_MIME_BY_EXT, SEEDABLE_EXTENSIONS } from './seedMedia'

// Upload validation
export {
  isLocalImagePath,
  resolvePublicImagePath,
  validateImageFileSize,
  validateLocalImageUrl
} from './uploadValidation'

// Paths & configuration
export {
  getProjectRoot,
  assertRunFromCms,
  PATHS,
  getContentPath,
  getConfigPath
} from './paths'
export {
  FOUNDATION_PAGE_CONTENT_POPULATE,
  BLOG_CONTENT_POPULATE,
  PROFILE_PAGE_CONTENT_POPULATE,
  GRANT_PAGE_CONTENT_POPULATE,
  GRANT_OVERVIEW_PAGE_CONTENT_POPULATE,
  REPORT_CONTENT_POPULATE,
  HACKATHON_PAGE_CONTENT_POPULATE,
  PODCAST_PAGE_CONTENT_POPULATE
} from './contentPopulate'

// MDX generation
export {
  type Hero,
  type HeroCta,
  heroFrontmatter,
  getPreservedFields,
  defaultLang,
  LOCALES,
  MATTER_STRINGIFY_OPTIONS,
  yamlSingleQuoteScalar,
  yamlLiteralBlockScalar,
  getImageUrl,
  hasMediaValue,
  looksLikeHtmlField,
  htmlFieldToMarkdown,
  ckeditorFieldToMarkdown,
  ckeditorBreaksToNewlines,
  formatBlockquote,
  uidToLogLabel,
  resolveFilenameSlug,
  pathSlugToMdxFilename,
  sectionScopedMdxFilename
} from './mdx'
export {
  validateNoNestedJsx,
  validateGrantPageFaqSection,
  validateFaqSections,
  validateGrantPagePrimaryCta,
  validateGrantInfoCards,
  validateReportDate,
  validateReportContent,
  validateAuthorBio,
  validateProfileCta,
  validateCtaStrip,
  validateHeroFields,
  validatePodcastPageFields,
  validateBlogFields,
  validateNavigationLabels,
  validateCardGridVariantsForContentType,
  toValidationError,
  mergeValidationErrors,
  SerializerFieldError,
  type FieldError
} from './contentValidation'

// Section-relative pathSlug uniqueness (cross-section content types)
export {
  validateSectionScopedSlug,
  type SectionScopedSlugFinder,
  type SectionScopedSlugCheck
} from './sectionScopedSlug'

// Card grid variants (serializers, sync handlers, admin picker)
export {
  CARD_GRID_COLUMNS,
  CARD_GRID_VARIANT_DEFINITIONS,
  CARD_GRID_VARIANTS,
  CARD_GRID_VARIANT_LABELS,
  CARD_GRID_VARIANT_FIELDS,
  CARD_GRID_FIELD_LABELS,
  CARD_GRID_VARIANT_COMPONENTS,
  CARD_GRID_VARIANT_CHILDREN,
  CARD_GRID_VARIANT_LIST_LABEL,
  CARD_GRID_ALLOWED_VARIANTS_BY_UID,
  getAllowedCardGridVariants,
  formatCardGridVariantList,
  isCardGridVariantAllowed,
  type CardGridColumns,
  type CardGridVariant,
  type CardGridCardsField,
  type CardGridSecondaryCta,
  type CardGridCard
} from './cardGrid'
export {
  CTA_BUTTON_STYLES,
  MIN_CTA_BUTTONS,
  MAX_CTA_BUTTONS,
  isCtaButtonStyle,
  hasConflictingCtaFlags,
  validateCtaButtonCount,
  validateCtaButtonStyles,
  validateCtaButtonComposition,
  type CtaButtonStyle,
  type CtaButtonEntry,
  type CtaButtonsRuleError
} from './ctaButtons'
export {
  deleteLocaleMdxFiles,
  removeLocalizesFromLocaleFiles
} from './localeMdxUtils'

// Report text types (serializers, sync handlers)
export {
  REPORT_TEXT_TYPES,
  isReportTextType,
  type ReportTextType
} from './reportText'

// Block serialization (dynamic-zone content -> MDX)
export { serializeContent, validateContentBlocks } from '../serializers/blocks'

// Git sync
export {
  type SyncContext,
  getTargetRepoRoot,
  validateGitSyncRepoOnStartup,
  scheduleGitSync,
  gitCommitAndPush
} from './gitSync'

// Lifecycle factories
export {
  type PageData,
  type PageLifecycleConfig,
  type StrapiDocumentServiceUpdateWhere,
  shouldSkipMdxExport,
  getAdminAuthor,
  resolvePageFilepath,
  generateMDX,
  createPageLifecycle,
  readLocaleFromUpdateEvent
} from './pageLifecycle'
export {
  createBlogLifecycle,
  generateBlogMDX,
  resolveBlogEnglishSlug,
  resolveBlogMdxFilename,
  stampBlogLocale
} from './blogLifecycle'
export {
  type ProfileMdxCta,
  type ProfileMdxInput,
  generateProfileMdx
} from './profileMdx'
export { type FaqMdxInput, generateFaqMdx } from './faqMdx'
export {
  type PodcastPageInput,
  type PodcastPageCtaStrip,
  type PodcastPageTitleCard,
  type PodcastPageTitleCardGrid,
  type PodcastPageItem,
  generatePodcastPageMdx
} from './podcastPageMdx'
export {
  type ReportMdxDate,
  type ReportMdxInput,
  generateReportMdx
} from './reportMdx'
export {
  type FlatContentLifecycleConfig,
  type FlatLocaleMdxLifecycleConfig,
  createFlatLocaleMdxLifecycle
} from './flatContentLifecycle'
export {
  type MenuItem,
  type MenuSubGroup,
  type MenuGroup,
  type NavigationLifecycleConfig,
  createNavigationLifecycle,
  normalizeNavigationInput
} from './navigationLifecycle'

// Relative link / path-segment slash normalization
export {
  ensureLeadingSlash,
  normalizePathSegment,
  normalizeRelativeLinksInDocumentData,
  stripUploadOrigin
} from './relativeLinks'
