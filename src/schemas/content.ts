import { z } from 'zod'

/** Date schema: accepts YYYY-MM-DD string, Date, or coercible value. */
const dateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  z.coerce.date(),
  z.date()
])

/** Foundation blog frontmatter schema. Shared by content.config and sync-mdx. */
export const foundationBlogFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  slug: z.string().min(1, 'slug is required'),
  lang: z.string().optional(),
  date: dateSchema,
  thumbnailImage: z.string().optional(),
  thumbnailImageAlt: z.string().optional(),
  featureImage: z.string().optional(),
  featureImageAlt: z.string().optional(),
  tags: z
    .array(
      z.enum([
        'Announcements',
        'Grants & Grantee Insights',
        'Community & Events',
        'Interledger Technology',
        'Thought Leadership',
        'Interledger Protocol',
        'Open Payments',
        'Rafiki',
        'Releases',
        'Updates',
        'Web Monetization'
      ])
    )
    .optional(),
  authors: z.array(z.string()).optional(),
  author_urls: z.array(z.string()).optional()
})

export type FoundationBlogFrontmatter = z.infer<
  typeof foundationBlogFrontmatterSchema
>

const CTA = z.object({
  label: z.string(),
  href: z.string()
})

const Section = z.object({
  title: z.string(),
  content: z.string(),
  ctas: z.array(CTA).optional()
})

/** Page frontmatter schema (foundation-pages, summit-pages). Shared by content.config and sync-mdx. */
export const pageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  slug: z.string().min(1, 'slug is required'),
  description: z.string().optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  sections: z.array(Section).optional()
})

export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>
