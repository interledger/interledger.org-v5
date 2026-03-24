import { z } from 'zod'

const foundationTags = [
  'Announcements',
  'Community & Events',
  'Grants & Grantee Insights',
  'Interledger Technology',
  'Thought Leadership'
] as const

const developersTags = [
  'Interledger Protocol',
  'Open Payments',
  'Rafiki',
  'Releases',
  'Updates',
  'Web Monetization',
  'Card Payments'
  // Please add a matching translation in i18n/ui.ts for any new tag
] as const
export type FoundationTag = (typeof foundationTags)[number]

export const developersBlogFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.date(),
  pathSlug: z.string(),
  locale: z.string().optional(),
  localizes: z.string().optional(),
  authors: z.array(z.string()).optional(),
  author_urls: z.array(z.string()).optional(),
  tags: z.array(z.enum(developersTags)),
  ogImageUrl: z.string().optional(),
  external_url: z.string().optional()
})

export type DevelopersBlogFrontmatterType = z.infer<
  typeof developersBlogFrontmatterSchema
>

const ArticleBioSchema = z.object({
  author: z.string(),
  text: z.string().optional(),
  image: z.string().optional()
})

export const foundationBlogFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  date: z.coerce.date(),
  pathSlug: z.string().min(1, 'pathSlug is required'),
  pillar: z.enum(['vision', 'mission', 'tech', 'values']),
  featureImage: z.string().optional(),
  featureImageAlt: z.string().optional(),
  thumbnailImage: z.string().optional(),
  thumbnailImageAlt: z.string().optional(),
  articleBios: z.array(ArticleBioSchema).optional().default([]),
  tags: z.array(z.enum(foundationTags)).default([]),
  localizes: z.string().optional(),
  locale: z.string().optional()
})

export type FoundationBlogFrontmatterType = z.infer<
  typeof foundationBlogFrontmatterSchema
>

export const foundationPageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  pathSlug: z.string().min(1, 'pathSlug is required'),
  description: z.string().optional(),
  pillar: z.enum(['vision', 'mission', 'tech', 'values']).optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
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
  pathSlug: z.string().min(1, 'pathSlug is required'),
  description: z.string().optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
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

export const ambassadorFrontmatterSchema = z.object({
  pathSlug: z.string().min(1, 'pathSlug is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().min(1, 'description is required'),
  /** URL path to the Strapi upload; nullable because the lifecycle writes null when no photo. */
  photo: z.string().nullable(),
  photoAlt: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  grantReportUrl: z.string().nullable().optional(),
  locale: z.string().optional(),
  localizes: z.string().optional()
})

// Legacy export for backward compatibility
export const pageFrontmatterSchema = foundationPageFrontmatterSchema
