import { defineCollection, z } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { glob } from 'astro/loaders'
import { PATHS } from './utils/paths'
import {
  foundationBlogFrontmatterSchema,
  pageFrontmatterSchema
} from './schemas/content'

const engBlogCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.developersBlog}`
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    lang: z.string(),
    date: z.date(),
    image: z.string().optional(),
    tags: z.array(
      z.enum([
        'Interledger Protocol',
        'Open Payments',
        'Rafiki',
        'Releases',
        'Updates',
        'Web Monetization'
        // Please add a matching translation in i18n/ui.ts for any new tag
      ])
    ),
    authors: z.array(z.string()),
    author_urls: z.array(z.string())
  })
})

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
  schema: pageFrontmatterSchema
})

const summitPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: `./${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summit}`
  }),
  schema: pageFrontmatterSchema
})

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }), // TODO: check base now since docs loader may have wrong path
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  'engineering-blog': engBlogCollection,
  'foundation-blog': foundationBlogCollection,
  'foundation-pages': foundationPagesCollection,
  'summit-pages': summitPagesCollection
}
