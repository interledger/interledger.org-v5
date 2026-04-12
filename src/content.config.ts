import { defineCollection } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { glob } from 'astro/loaders'
import { PATHS } from '../cms/src/utils/paths'
import {
  ambassadorFrontmatterSchema,
  developersBlogFrontmatterSchema,
  foundationBlogFrontmatterSchema,
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema
} from './schemas/content'

const foundationBlogCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.blog}`
  }),
  schema: foundationBlogFrontmatterSchema
})

const foundationPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.foundationPages}`
  }),
  schema: foundationPageFrontmatterSchema
})

const summitPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summitPages}`
  }),
  schema: summitPageFrontmatterSchema
})

const developersBlogCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.developersBlog}`
  }),
  schema: developersBlogFrontmatterSchema
})

const ambassadorCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.mdx',
    base: `./${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.ambassadors}`
  }),
  schema: ambassadorFrontmatterSchema
})

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  'developers-blog': developersBlogCollection,
  'foundation-blog': foundationBlogCollection,
  'foundation-pages': foundationPagesCollection,
  'summit-pages': summitPagesCollection,
  ambassadors: ambassadorCollection
}

export type CollectionType = keyof typeof collections

export type BlogCollectionType = Extract<
  keyof typeof collections,
  'developers-blog' | 'foundation-blog'
>
