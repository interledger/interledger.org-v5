// Types
export { type StrapiDocumentAPI, type StrapiAdminUser, type StrapiGlobal } from './strapiTypes'

// Paths & configuration
export { getProjectRoot, getCmsDir, assertRunFromCms, PATHS, getContentPath, getConfigPath } from './paths'
export { FOUNDATION_PAGE_CONTENT_POPULATE, BLOG_CONTENT_POPULATE } from './contentPopulate'

// MDX & content
export {
  defaultLang,
  LOCALES,
  uidToLogLabel,
  MATTER_STRINGIFY_OPTIONS,
  yamlSingleQuoteScalar,
  getImageUrl,
  htmlToMarkdown,
  markdownToHtml,
  formatBlockquote,
  getPreservedFields,
  type HeroCta,
  heroFrontmatter,
  seoFrontmatter
} from './mdx'
export { validateNoNestedJsx } from './contentValidation'
export { removeLocalizesFromLocaleFiles, deleteLocaleMdxFiles } from './localeMdxUtils'

// Git sync
export {
  type SyncContext,
  getTargetRepoRoot,
  resolveTargetRepoPath,
  validateGitSyncRepoOnStartup,
  scheduleGitSync,
  gitCommitAndPush
} from './gitSync'

// Lifecycle factories
export {
  shouldSkipMdxExport,
  getAdminAuthor,
  type PageLifecycleConfig,
  type StrapiDocumentServiceUpdateWhere,
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
export { type NavigationLifecycleConfig, createNavigationLifecycle } from './navigationLifecycle'
