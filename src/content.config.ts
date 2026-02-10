import { defineCollection, z } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { glob } from 'astro/loaders'

const CTA = z.object({
  label: z.string(),
  href: z.string()
})

const Section = z.object({
  title: z.string(),
  content: z.string(),
  ctas: z.array(CTA).optional()
})

const pageSchema = z.object({
    title: z.string(),
    slug: z.string(),
    contentId: z.string(),
    description: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    sections: z.array(Section).optional()
  })

const engBlogCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/developers/blog' }),
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
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    lang: z.string().optional(),
    date: z.date(),
    pillar: z.string(),
    thumbnailImage: z.string().optional(),
    thumbnailImageAlt: z.string().optional(),
    featureImage: z.string().optional(),
    featureImageAlt: z.string().optional(),
    tags: z.array(
      z.enum([
        'Announcements',
        'Grants & Grantee Insights',
        'Community & Events',
        'Interledger Technology',
        'Thought Leadership',
        // Please add a matching translation in i18n/ui.ts for any new tag
      ]).optional()
    ),
    authors: z.array(z.string()).optional(),
    author_urls: z.array(z.string()).optional()
  })
})

const foundationPagesCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/foundation-pages' }),
  schema: pageSchema
})

const summitPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/summit'
  }),
  schema: pageSchema
})

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }), // TODO: check base now since docs loader may have wrong path
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  'engineering-blog': engBlogCollection,
  'foundation-blog': foundationBlogCollection,
  'foundation-pages': foundationPagesCollection,
  'summit-pages': summitPagesCollection
}
