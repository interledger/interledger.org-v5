# src/utils

Shared utility modules for the Astro site. Import from `@/utils` — the barrel at `index.ts` explicitly exports every function by name, grouped by domain.

---

## URL & Routing

| Module               | Exports                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `url.ts`             | `stripTrailingSlash` — removes a trailing `/` from a path string                              |
| `routes.ts`          | `HOME_SLUG`, `ROUTE_BASES`, `RouteCollection`, `normalizeBasePath`, `localizeRoute`           |
| `routeContext.ts`    | `RouteContext`, `routeContextFromPathname` — derives locale/slug/basePath from a URL pathname |
| `stripPagination.ts` | `stripPagination` — removes a trailing page number segment from a path                        |

## Internationalisation

| Module                  | Exports                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `i18.ts`                | `locales`, `Locale`, `localeSchema`, `defaultLocale`, `switcherLocales`                  |
| `translationMap.ts`     | `buildMap`, `TranslationEntry` — builds the slug→locale map from all content collections |
| `translationMapData.ts` | `translationMap` — pre-built singleton of the translation map                            |

## Data Fetching

| Module           | Exports                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| `fetchStrapi.ts` | `fetchStrapi` — authenticated fetch wrapper for the Strapi API                      |
| `cache.ts`       | `CACHE_CONTROL`, `applyPreviewNoStore` — Cache-Control header constants and helpers |

## Static Paths

| Module            | Exports                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `static-paths.ts` | `getLocalizedPaths`, `CollectionType` — builds `getStaticPaths` output for localized collection routes |
| `tagFilter.ts`    | `getTagSlug`, `getTagUrl`, `paginateAllPosts`, `paginatePostsByTag`                                    |

## Text

| Module              | Exports                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `slug.ts`           | `generateSlug` — Drupal-compatible slug generator with transliteration and stop-word removal |
| `text.ts`           | `truncateText` — truncates a string to a word boundary                                       |
| `mdx.ts`            | `parseMarkdown`, `parseMarkdownInline` — renders Markdown to HTML via `marked`               |
| `create-excerpt.ts` | `createExcerpt` — strips Markdown/HTML to plain text for meta descriptions                   |

## Formatting

| Module    | Exports                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `time.ts` | `formatDate`, `getDurationInMinutes` — locale-aware date formatting and duration maths |

## Media & UI

| Module                | Exports                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `video.ts`            | `detectVideoProvider` — returns `'youtube'`, `'vimeo'`, or `null` from a URL               |
| `heroSectionStyle.ts` | `getHeroSectionStyle` — returns an inline `backgroundImage` style object for hero sections |

## Summit

| Module                     | Exports                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionize.ts`            | `sessionizeApiMap`, `YEARS`, `currentSummitYear` — API endpoint map and year list                                                                   |
| `extractSessionize.ts`     | `getSpeakers`, `getTalks`, `getTalkPreviews` — parse raw Sessionize JSON into typed models                                                          |
| `summit-talks-speakers.ts` | `paginateSummitTalks`, `paginateSummitSpeakers`, `getSpeakerPages`, `getSessionPages`, `getTranslation` — `getStaticPaths` helpers for summit pages |

---

## Not in the barrel

`paths.ts` is a CMS-only filesystem utility (Node.js `path` API). It is used by CMS scripts and must not be imported into Astro components.
