/**
 * Canonical locale list — `astro.config.mjs` imports this directly for
 * `i18n.locales`, so there's nothing to keep in sync by hand. Plain (no
 * Astro imports) so it's also usable from `locales.ts` (which re-derives the
 * same list from `astro:i18n` at runtime — that's fine, it'll always match
 * since the config it reads is the config built from this array) and from
 * modules that must run in the Vitest unit-test runtime, where Astro's
 * virtual modules (`astro:config/client`, `astro:i18n`) aren't available.
 */
export const LOCALE_CODES = ['es', 'en'] as const
export type LocaleCode = (typeof LOCALE_CODES)[number]
