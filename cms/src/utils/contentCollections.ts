/**
 * Which filename rule each exported content collection follows.
 *
 * The Strapi lifecycles apply these rules one collection at a time, so nothing
 * in the running CMS ever sees the whole set. `scripts/check-mdx-filenames.ts`
 * does, and reads it from here.
 *
 * Keep an entry for every key in `PATHS.CONTENT`. `contentCollections.test.ts`
 * fails when the two drift, so a new collection cannot ship unchecked.
 */

import { PATHS } from './paths'
import type { MdxNamingRule } from './mdxFilenames'

export type ContentCollection = keyof typeof PATHS.CONTENT

/** Naming rule per collection. See {@link MdxNamingRule} for what each does. */
export const CONTENT_COLLECTION_NAMING_RULES: Record<
  ContentCollection,
  MdxNamingRule
> = {
  blog: 'blog',
  foundationPages: 'page',
  grantPages: 'page',
  grantOverviewPages: 'page',
  summitPages: 'page',
  hackathonPages: 'page',
  podcastPages: 'page',
  profiles: 'flat-section',
  faqs: 'flat-section',
  reports: 'flat-section'
}

export const CONTENT_COLLECTIONS = Object.keys(
  CONTENT_COLLECTION_NAMING_RULES
) as ContentCollection[]
