import { z } from 'zod'
import { localeSchema } from '../i18/utils'

export const foundationBlogFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.date(),
  pathSlug: z.string(),
  pillar: z.string().optional(),
  featureImage: z.string().optional(),
  featureImageAlt: z.string().optional(),
  thumbnailImage: z.string().optional(),
  thumbnailImageAlt: z.string().optional(),
  tags: z.array(z.string()),
  lang: localeSchema
})

export const foundationPageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  pathSlug: z.string().min(1, 'slug is required'),
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
  locale: z.string().optional(),
  lang: localeSchema
})

export const summitPageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  pathSlug: z.string().min(1, 'slug is required'),
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
  locale: z.string().optional(),
  lang: localeSchema
})

// Legacy export for backward compatibility
export const pageFrontmatterSchema = foundationPageFrontmatterSchema
