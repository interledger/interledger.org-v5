import { z } from 'astro:content'

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

export const pageFrontmatterSchema = z.object({
  slug: z.string(),
  title: z.string(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional()
})
