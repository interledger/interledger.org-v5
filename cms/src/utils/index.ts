// Types
export {
  type StrapiDocumentAPI,
  type StrapiAdminUser,
  type StrapiGlobal
} from './strapiTypes'

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
  BLOG_CONTENT_POPULATE
} from './contentPopulate'

// MDX generation
export {
  type HeroCta,
  heroFrontmatter,
  seoFrontmatter,
  getPreservedFields
} from './mdx'
export {
  defaultLang,
  LOCALES,
  MATTER_STRINGIFY_OPTIONS,
  yamlSingleQuoteScalar
} from './mdx'
export {
  getImageUrl,
  htmlToMarkdown,
  formatBlockquote,
  uidToLogLabel
} from './mdx'
export { validateNoNestedJsx } from './contentValidation'
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
  type PageLifecycleConfig,
  type StrapiDocumentServiceUpdateWhere,
  shouldSkipMdxExport,
  getAdminAuthor,
  resolvePageFilepath,
  generateMDX,
  createPageLifecycle,
  readLocaleFromUpdateEvent
} from './pageLifecycle'
export { createBlogLifecycle } from './blogLifecycle'
export {
  type FlatContentLifecycleConfig,
  type FlatLocaleMdxLifecycleConfig,
  createFlatLocaleMdxLifecycle
} from './flatContentLifecycle'
export {
  type NavigationLifecycleConfig,
  createNavigationLifecycle
} from './navigationLifecycle'
