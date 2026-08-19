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
    /**
     * Which site is rendering, set by the microsite layout's frontmatter and
     * absent on the foundation site.
     *
     * The single source of site identity. `BaseLayout` writes it to `data-site`
     * on <html>, where the token overrides key off it, and components read it
     * directly. Deriving it a second way, from the URL for instance, lets the
     * two disagree (Jonathan, #520).
     *
     * A layout's frontmatter runs before its `<slot />` renders, so this is set
     * by the time any block inside the page reads it.
     */
    site?: import('@/types/navigation').MicrositeSite
    /** Preloaded in MDX page shells so ProfileGrid avoids stale collection reads on HMR. */
    profileEntries?: import('astro:content').CollectionEntry<'profiles'>[]
  }
}
