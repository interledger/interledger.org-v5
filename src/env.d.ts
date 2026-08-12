// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Injected by Vite `define` in astro.config.mjs; absent under plain vitest.
declare const __IMAGE_CDN_ENABLED__: boolean | undefined

declare namespace App {
  interface Locals {
    routeLocale: import('@/utils/i18').Locale
    currentSlug: string
    currentBasePath: string
    /** Preloaded in MDX page shells so ProfileGrid avoids stale collection reads on HMR. */
    profileEntries?: import('astro:content').CollectionEntry<'profiles'>[]
  }
}
