import path from 'path'

/** Current working directory. All cwd access goes through this. */
function getCwd(): string {
  return process.cwd()
}

/**
 * Project root (Astro site root). Works when run from cms/ or from project root.
 * - From cms/: returns parent directory
 * - From project root: returns cwd
 */
export function getProjectRoot(): string {
  const cwd = getCwd()
  return path.basename(cwd) === 'cms' ? path.resolve(cwd, '..') : cwd
}

/** CMS directory (absolute path). Works regardless of cwd. */
export function getCmsDir(): string {
  return path.join(getProjectRoot(), 'cms')
}

/** Path segments relative to project root (Astro site root when cms runs from cms/). */
export const PATHS = {
  CONTENT_ROOT: 'src/content',
  CONFIG_ROOT: 'src/config',
  UPLOADS: 'public/uploads',
  /** Content subdirs for each type (used under CONTENT_ROOT and CONTENT_ROOT/{locale}/). */
  CONTENT: {
    blog: 'foundation-blog-posts',
    developersBlog: 'developers/blog',
    foundationPages: 'foundation-pages',
    summitPages: 'summit-pages'
  },
  /** Public asset paths. */
  PUBLIC: 'public',
  /** Subdir under public for Drupal-imported blog images. */
  FOUNDATION_BLOG_IMG: 'img/foundation-blog',
  CONFIG: {
    foundationNavigation: 'foundation-navigation.json',
    summitNavigation: 'summit-navigation.json'
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
    return path.join(projectRoot, PATHS.CONTENT_ROOT, locale, subdir)
  }
  return path.join(projectRoot, PATHS.CONTENT_ROOT, subdir)
}

export function getConfigPath(
  projectRoot: string,
  name: keyof typeof PATHS.CONFIG
): string {
  return path.join(projectRoot, PATHS.CONFIG_ROOT, PATHS.CONFIG[name])
}
