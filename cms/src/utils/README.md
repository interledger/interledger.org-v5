# cms/src/utils

Shared utility modules for the Strapi CMS layer. Import from `@/utils` — the barrel at `index.ts` explicitly exports every function by name, grouped by domain.

---

## Types

| Module | Exports |
|---|---|
| `strapiTypes.ts` | `StrapiDocumentAPI`, `StrapiAdminUser`, `StrapiGlobal` — Strapi v5 interface shapes |

## Paths & Configuration

| Module | Exports |
|---|---|
| `paths.ts` | `PATHS`, `getProjectRoot`, `getCmsDir`, `assertRunFromCms`, `getContentPath`, `getConfigPath` — filesystem path resolution, works from `cms/` or project root |
| `contentPopulate.ts` | `FOUNDATION_PAGE_CONTENT_POPULATE`, `BLOG_CONTENT_POPULATE` — Strapi populate configs for dynamic zone `content` fields |

## MDX & Content

| Module | Exports |
|---|---|
| `mdx.ts` | `defaultLang`, `LOCALES`, `MATTER_STRINGIFY_OPTIONS`, `uidToLogLabel`, `yamlSingleQuoteScalar`, `getImageUrl`, `htmlToMarkdown`, `markdownToHtml`, `formatBlockquote`, `getPreservedFields`, `HeroCta`, `heroFrontmatter`, `seoFrontmatter` — MDX/YAML generation and Markdown conversion |
| `contentValidation.ts` | `validateNoNestedJsx` — rejects bare JSX in paragraph blocks before they reach the DB |
| `localeMdxUtils.ts` | `deleteLocaleMdxFiles`, `removeLocalizesFromLocaleFiles` — locale MDX file management |

## Git Sync

| Module | Exports |
|---|---|
| `gitSync.ts` | `SyncContext`, `getTargetRepoRoot`, `resolveTargetRepoPath`, `validateGitSyncRepoOnStartup`, `scheduleGitSync`, `gitCommitAndPush` — debounced git commit/push to the target repo |

## Lifecycle Factories

| Module | Exports |
|---|---|
| `pageLifecycle.ts` | `PageLifecycleConfig`, `StrapiDocumentServiceUpdateWhere`, `shouldSkipMdxExport`, `getAdminAuthor`, `resolvePageFilepath`, `generateMDX`, `createPageLifecycle`, `readLocaleFromUpdateEvent` — Strapi lifecycle hooks for CMS page content types |
| `blogLifecycle.ts` | `createBlogLifecycle` — lifecycle hooks for blog posts |
| `flatContentLifecycle.ts` | `FlatContentLifecycleConfig`, `FlatLocaleMdxLifecycleConfig`, `createFlatLocaleMdxLifecycle` — lifecycle hooks for flat (non-page) content types such as ambassadors |
| `navigationLifecycle.ts` | `NavigationLifecycleConfig`, `createNavigationLifecycle` — lifecycle hooks for navigation JSON export |
