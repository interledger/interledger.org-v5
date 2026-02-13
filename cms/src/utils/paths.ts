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

/** Path segments relative to project root. */
export const PATHS = {
  CONFIG_ROOT: 'src/config',
  CONFIG: {
    foundationNavigation: 'foundation-navigation.json',
    summitNavigation: 'summit-navigation.json',
  },
} as const
