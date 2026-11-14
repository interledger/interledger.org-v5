import path from 'path'

/** Current working directory. All cwd access goes through this. */
function getCwd(): string {
  return process.cwd()
}

/**
 * Project root (Astro site root): where `src/content`, `src/config` and `public` live.
 * - STRAPI_PROJECT_ROOT, when set. The container image runs the CMS from /app/cms
 *   while the repository checkout lives on a volume, so the parent of cwd is not it.
 * - From cms/: returns parent directory
 * - From project root: returns cwd
 */
export function getProjectRoot(): string {
  const configured = process.env.STRAPI_PROJECT_ROOT
  if (configured) return path.resolve(configured)
  const cwd = getCwd()
  return path.basename(cwd) === 'cms' ? path.resolve(cwd, '..') : cwd
}

/**
 * Absolute path of the SQLite database. config/database.ts and the startup
 * permission check both read it, so they always agree on the file.
 */
export function getDatabaseFilePath(): string {
  return path.resolve(getCwd(), process.env.DATABASE_FILENAME || PATHS.DB_FILE)
}

/** Exits if not run from cms directory. */
export function assertRunFromCms(): void {
  if (path.basename(getCwd()) !== 'cms') {
    console.error('❌ Error: run this script from the cms directory')
    console.error('   Example: cd cms && pnpm run <command>')
    process.exit(1)
  }
}

/** Path segments relative to project root (Astro site root when cms runs from cms/). */
export const PATHS = {
  CONTENT_ROOT: 'src/content',
  CONFIG_ROOT: 'src/config',
  DATA_ROOT: 'src/data',
  UPLOADS: 'public/uploads/img/original',
  /** Content subdirs for each type (used under CONTENT_ROOT and CONTENT_ROOT/<type>/{locale}). */
  CONTENT: {
    blog: 'foundation-blog-posts',
    foundationPages: 'foundation-pages',
    fundraisingPages: 'fundraising-pages',
    grantPages: 'grant-pages',
    grantOverviewPages: 'grant-overview-pages',
    summitPages: 'summit-pages',
    hackathonPages: 'hackathon-pages',
    profiles: 'profiles',
    faqs: 'faqs',
    reports: 'reports',
    podcastPages: 'podcast-pages'
  },
  /** Public asset paths. */
  PUBLIC: 'public',
  /** Subdir under public for Drupal-imported blog images. */
  FOUNDATION_BLOG_IMG: 'img/foundation-blog',
  CONFIG: {
    foundationNavigation: 'foundation-navigation.json',
    summitNavigation: 'summit-navigation.json',
    hackathonNavigation: 'hackathon-navigation.json',
    redirects: 'redirects.json'
  },
  /** CMS-internal paths (relative to cms/ when cwd is cms). */
  TMP: '.tmp',
  DB_FILE: '.tmp/data.db'
} as const

export function getContentPath(
  projectRoot: string,
  contentType: keyof typeof PATHS.CONTENT,
  locale?: string
): string {
  const subdir = PATHS.CONTENT[contentType]
  if (locale && locale !== 'en') {
    return path.join(projectRoot, PATHS.CONTENT_ROOT, subdir, locale)
  }
  return path.join(projectRoot, PATHS.CONTENT_ROOT, subdir)
}

export function getConfigPath(
  projectRoot: string,
  name: keyof typeof PATHS.CONFIG
): string {
  return path.join(projectRoot, PATHS.CONFIG_ROOT, PATHS.CONFIG[name])
}
