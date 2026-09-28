/**
 * Locale constants for the MDX export.
 *
 * These live apart from `mdx.ts` so that pure modules such as
 * `mdxFilenames.ts` can read them without pulling in prettier, sharp and the
 * rest of the MDX generation chain.
 */

/** Locale that owns the canonical content. Its files carry no locale folder. */
export const defaultLang = 'en'

/** Every locale the site exports. */
export const LOCALES = [defaultLang, 'es']
