import { defineCollection } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { glob } from 'astro/loaders'
import { PATHS } from './utils/paths'
import {
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

const engineeringBlogCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.developersBlog}`
  }),
  schema: developersBlogFrontmatterSchema
})

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }), // TODO: check base now since docs loader may have wrong path
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  'engineering-blog': engineeringBlogCollection,
  'foundation-blog': foundationBlogCollection,
  'foundation-pages': foundationPagesCollection,
  'summit-pages': summitPagesCollection
}
