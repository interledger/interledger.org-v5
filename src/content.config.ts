import { defineCollection } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { glob } from 'astro/loaders'
import {
  foundationBlogFrontmatterSchema,
  foundationPageFrontmatterSchema,
  grantOverviewPageFrontmatterSchema,
  grantPageFrontmatterSchema,
  profileFrontmatterSchema,
  reportFrontmatterSchema,
  summitPageFrontmatterSchema
} from './schemas/content'
import { CONTENT, CONTENT_ROOT } from '@/utils/main/contentCollections'

const foundationBlogCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.blog}`
  }),
  schema: foundationBlogFrontmatterSchema
})

const foundationPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.foundationPages}`
  }),
  schema: foundationPageFrontmatterSchema
})

const grantPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.grantPages}`
  }),
  schema: grantPageFrontmatterSchema
})

const grantOverviewPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.grantOverviewPages}`
  }),
  schema: grantOverviewPageFrontmatterSchema
})

const summitPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.summitPages}`
  }),
  schema: summitPageFrontmatterSchema
})

const profilesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.profiles}`
  }),
  schema: profileFrontmatterSchema
})

const reportsCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.reports}`
  }),
  schema: reportFrontmatterSchema
})

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  'foundation-blog': foundationBlogCollection,
  'foundation-pages': foundationPagesCollection,
  'grant-pages': grantPagesCollection,
  'grant-overview-pages': grantOverviewPagesCollection,
  'summit-pages': summitPagesCollection,
  profiles: profilesCollection,
  reports: reportsCollection
}

export type CollectionType = keyof typeof collections

export type BlogCollectionType = Extract<
  keyof typeof collections,
  'foundation-blog'
>
