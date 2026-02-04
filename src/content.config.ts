import { defineCollection, z } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { glob } from 'astro/loaders'

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
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    sections: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(),
          ctas: z
            .array(
              z.object({
                label: z.string(),
                href: z.string()
              })
            )
            .optional()
        })
      )
      .optional()
  })
})

const foundationPagesCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/foundation-pages' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    sections: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(),
          ctas: z
            .array(
              z.object({
                label: z.string(),
                href: z.string()
              })
            )
            .optional()
        })
      )
      .optional()
  })
})

const summitPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/summit'
  }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    gradient: z.string().optional(),
    sections: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(),
          ctas: z
            .array(
              z.object({
                label: z.string(),
                href: z.string()
              })
            )
            .optional()
        })
      )
      .optional()
  })
})

const hackathonPagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/summit/hackathon'
  }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    gradient: z.string().optional(),
    sections: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(),
          ctas: z
            .array(
              z.object({
                label: z.string(),
                href: z.string()
              })
            )
            .optional()
        })
      )
      .optional()
  })
})

const hackathonResourcePagesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/summit/hackathon'
  }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    heroImage: z.string().optional(),
    gradient: z.string().optional(),
    sections: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(),
          ctas: z
            .array(
              z.object({
                label: z.string(),
                href: z.string()
              })
            )
            .optional()
        })
      )
      .optional()
  })
})

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }), // TODO: check base now since docs loader may have wrong path
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  'engineering-blog': engBlogCollection,
  'foundation-blog': foundationBlogCollection,
  'foundation-pages': foundationPagesCollection,
  'summit-pages': summitPagesCollection,
  'hackathon-pages': hackathonPagesCollection,
  'hackathon-resource-pages': hackathonResourcePagesCollection,
  'grant-pages': grantPagesCollection
}
