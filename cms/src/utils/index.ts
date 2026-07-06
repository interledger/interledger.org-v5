// Error handling
export { tryCatchAsync } from './tryCatch'

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
  GRANT_PAGE_CONTENT_POPULATE,
  GRANT_OVERVIEW_PAGE_CONTENT_POPULATE
} from './contentPopulate'

// MDX generation
export {
  type HeroCta,
  heroFrontmatter,
  seoFrontmatter,
  getPreservedFields,
  defaultLang,
  LOCALES,
  MATTER_STRINGIFY_OPTIONS,
  yamlSingleQuoteScalar,
  yamlLiteralBlockScalar,
  getImageUrl,
  htmlToMarkdown,
  formatBlockquote,
  uidToLogLabel,
  resolveFilenameSlug
} from './mdx'
export {
  validateNoNestedJsx,
  validateGrantPagePrimaryCta,
  validateHeroFields,
  validateBlogFields,
  validateNavigationLabels,
  toValidationError
} from './contentValidation'
export {
  deleteLocaleMdxFiles,
  removeLocalizesFromLocaleFiles
} from './localeMdxUtils'

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
export { createBlogLifecycle, generateBlogMDX } from './blogLifecycle'
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
