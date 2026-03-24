// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    routeLocale: import('@/utils/i18').Locale
    currentSlug: string
    currentBasePath: string
  }
}
