import { z } from 'zod'

export const developersBlogFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.date(),
  slug: z.string(),
  lang: z.string().optional(),
  authors: z.array(z.string()).optional(),
  author_urls: z.array(z.string()).optional(),
  tags: z.array(
      z.enum([
        'Interledger Protocol',
        'Open Payments',
        'Rafiki',
        'Releases',
        'Updates',
        'Web Monetization',
        'Card Payments'
        // Please add a matching translation in i18n/ui.ts for any new tag
      ])
    ),
    ogImageUrl: z.string().optional()
})

export const foundationBlogFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.date(),
  slug: z.string(),
  pillar: z.string().optional(),
  featureImage: z.string().optional(),
  featureImageAlt: z.string().optional(),
  thumbnailImage: z.string().optional(),
  thumbnailImageAlt: z.string().optional(),
  tags: z.array(z.string())
})

export const foundationPageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  slug: z.string().min(1, 'slug is required'),
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
    .optional(),
  localizes: z.string().optional(),
  locale: z.string().optional()
})

export const summitPageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  slug: z.string().min(1, 'slug is required'),
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
    .optional(),
  localizes: z.string().optional(),
  locale: z.string().optional()
})

// Legacy export for backward compatibility
export const pageFrontmatterSchema = foundationPageFrontmatterSchema
