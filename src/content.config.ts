import { defineCollection } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { glob } from 'astro/loaders'
import {
  ambassadorFrontmatterSchema,
  developersBlogFrontmatterSchema,
  foundationBlogFrontmatterSchema,
  foundationPageFrontmatterSchema,
  summitPageFrontmatterSchema
} from './schemas/content'
import { CONTENT, CONTENT_ROOT } from '@/utils/astroContentCollections'

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

const summitPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.summitPages}`
  }),
  schema: summitPageFrontmatterSchema
})

const developersBlogCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${CONTENT_ROOT}/${CONTENT.developersBlog}`
  }),
  schema: developersBlogFrontmatterSchema
})

const ambassadorCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.mdx',
    base: `./${CONTENT_ROOT}/${CONTENT.ambassadors}`
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
