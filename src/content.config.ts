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
  description: z.string().optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  sections: z.array(Section).optional(),
  gradient: z.string().optional()
})

const engBlogCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/developers/blog'
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

// TODO: add correct fields
const foundationBlogCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
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

const grantPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/grants'
  }),
  schema: pageSchema
})

const foundationPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/foundation-pages'
  }),
  schema: pageSchema
})

const summitPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/summit'
  }),
  schema: pageSchema
})

const hackathonPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/summit/hackathon'
  }),
  schema: pageSchema
})

const hackathonResourcePagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/summit/hackathon/resources'
  }),
  schema: pageSchema
})

const ambassadorSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  descriptionPlainText: z.string().optional(),
  photo: z.string(),
  photoAlt: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  grantReportUrl: z.string().nullable().optional()
})

const ambassadorCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.json',
    base: './src/content/ambassadors'
  }),
  schema: ambassadorSchema
})

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  'engineering-blog': engBlogCollection,
  'foundation-blog': foundationBlogCollection,
  'foundation-pages': foundationPagesCollection,
  'summit-pages': summitPagesCollection,
  'hackathon-pages': hackathonPagesCollection,
  'hackathon-resource-pages': hackathonResourcePagesCollection,
  'grant-pages': grantPagesCollection,
  ambassadors: ambassadorCollection
}
