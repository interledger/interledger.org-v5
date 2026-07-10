import { z } from 'zod'

const heroCtaSchema = z.object({
  text: z.string(),
  link: z.string(),
  style: z.enum(['primary', 'secondary']).optional(),
  external: z.boolean().optional()
})

// Normalizes pathSlug by stripping any leading or trailing slashes so that
// "grants/web-grant", "/grants/web-grant", "grants/web-grant/", and
// "/grants/web-grant/" all resolve to the same route.
const pathSlugSchema = (required = true) => {
  const base = z.string().transform((s) => s.replace(/^\/+|\/+$/g, ''))
  return required
    ? base.refine((s) => s.length > 0, 'pathSlug is required')
    : base
}

// Allowed blog categories. Keep in sync with the `shared.category` Strapi component
// (cms/src/components/shared/category.json) and the `blog.categories.*` keys in
// src/data/ui.ts. Comms will provide an updated list later (INTORG-765); when it
// lands, add the new values here and retire the legacy ones.
const blogCategories = [
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
  'Card Payments',
  'Integration',
  'Work Week',
  'Subscriptions',
  'Pay in installments',
  'HSM',
  'Interledger Wallet'
  // Please add a matching translation in src/data/ui.ts for any new tag
] as const
export type BlogCategory = (typeof blogCategories)[number]

export const developersBlogFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.date(),
  pathSlug: pathSlugSchema(),
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
  link: z.string().optional(),
  text: z.string().optional(),
  image: z.string().optional(),
  imageAlt: z.string().nullable().optional()
})

export type ArticleBioType = z.infer<typeof ArticleBioSchema>

export const foundationBlogFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  date: z.coerce.date(),
  // Optional manual entry — only set when a post has a meaningful editorial update.
  lastUpdated: z.coerce.date().optional(),
  pathSlug: pathSlugSchema(),
  // Pins the post into the featured section at the top of the blog listing.
  featured: z.boolean().default(false),
  // Desktop feature image. Kept optional in zod so mid-migration files don't break;
  // Strapi enforces it as required for editors.
  featureImage: z.string().optional(),
  featureImageAlt: z.string().nullable().optional(),
  // Optional mobile feature image; falls back to the desktop image when absent.
  featureImageMobile: z.string().optional(),
  featureImageMobileAlt: z.string().nullable().optional(),
  thumbnailImage: z.string().optional(),
  thumbnailImageAlt: z.string().nullable().optional(),
  articleBios: z.array(ArticleBioSchema).optional().default([]),
  categories: z.array(z.enum(blogCategories)).default([]),
  // Exactly 3 slugs of related posts when populated; optional for now so builds pass.
  relatedArticles: z.array(z.string()).max(3).optional().default([]),
  // Reserved for migrated v4 developer blog posts; lets them render without
  // a feature image or thumbnail. Hidden from Strapi editors.
  legacy: z.boolean().optional().default(false),
  localizes: z.string().optional(),
  locale: z.string().optional()
})

export type FoundationBlogFrontmatterType = z.infer<
  typeof foundationBlogFrontmatterSchema
>

export const foundationPageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  pathSlug: pathSlugSchema(),
  description: z.string().optional(),
  pillar: z.enum(['vision', 'mission', 'tech', 'values']).optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  heroImageAlt: z.string().nullable().optional(),
  heroCtas: z.array(heroCtaSchema).optional(),
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
  pathSlug: pathSlugSchema(),
  description: z.string().optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  heroImageAlt: z.string().nullable().optional(),
  heroCtas: z.array(heroCtaSchema).optional(),
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

const grantCtaStripSchema = z.object({
  heading: z.string(),
  description: z.string(),
  buttonText: z.string(),
  buttonLink: z.string(),
  color: z.enum(['purple', 'green']).default('purple'),
  secondaryButtonText: z.string().optional(),
  secondaryButtonLink: z.string().optional()
})

const grantInfoCardSchema = z.object({
  heading: z.string().min(1, 'card heading is required'),
  body: z.string().min(1, 'card body is required')
})

const grantInfoCardsSchema = z.object({
  heading: z.string().optional(),
  cards: z.tuple([
    grantInfoCardSchema,
    grantInfoCardSchema,
    grantInfoCardSchema
  ])
})

const grantFaqItemSchema = z.object({
  question: z.string().min(1, 'question is required'),
  answer: z.string().min(1, 'answer is required')
})

const grantFaqSectionSchema = z.object({
  title: z.string().min(1, 'title is required'),
  subtitle: z.string().min(1, 'subtitle is required'),
  description: z.string().min(1, 'description is required'),
  ctaText: z.string().min(1, 'ctaText is required'),
  ctaLink: z.string().min(1, 'ctaLink is required'),
  items: z.array(grantFaqItemSchema).min(2)
})

export const grantPageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  pathSlug: pathSlugSchema(),
  description: z.string().min(1, 'description is required'),
  programOverview: z.string().optional(),
  primaryCta: z
    .object({
      text: z.string(),
      link: z.string(),
      external: z.boolean().optional()
    })
    .optional(),
  faqSection: grantFaqSectionSchema.optional(),
  ctaStrip: grantCtaStripSchema,
  infoCards: grantInfoCardsSchema.optional(),
  metaImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
  localizes: z.string().optional(),
  locale: z.string().optional()
})

export type GrantPageFrontmatterType = z.infer<
  typeof grantPageFrontmatterSchema
>

export const grantOverviewPageFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  pathSlug: pathSlugSchema(),
  description: z.string().min(1, 'description is required'),
  ctaStrip: grantCtaStripSchema,
  metaImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
  localizes: z.string().optional(),
  locale: z.string().optional()
})

export type GrantOverviewPageFrontmatterType = z.infer<
  typeof grantOverviewPageFrontmatterSchema
>

// Profile pages (ambassadors, judges, leadership, etc., grouped by the free-text
// `category` field). For `section: foundation`, pathSlug is the full site path
// (e.g. grant/fellowship/jane-doe, team/jane-doe). For summit or hackathon,
// pathSlug is relative to that section prefix (e.g. 2025/judges/jane-doe).
export const profileFrontmatterSchema = z.object({
  pathSlug: pathSlugSchema(),
  name: z.string().min(1, 'name is required'),
  section: z.enum(['summit', 'hackathon', 'foundation']),
  /** URL path to the Strapi upload; nullable because the lifecycle writes null when no photo. */
  photo: z.string().nullable(),
  photoAlt: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  cta: heroCtaSchema.optional(),
  locale: z.string(),
  localizes: z.string().optional()
})
export type ProfileFrontmatterType = z.infer<typeof profileFrontmatterSchema>

// Bare-bones FAQ page template (INTORG-865). FAQ items/accordion/TOC land in a
// later pass (INTORG-749) as an optional dynamic-zone `content` field — this
// schema intentionally has no body/component surface yet.
export const faqFrontmatterSchema = z.object({
  pathSlug: pathSlugSchema(),
  title: z.string().min(1, 'title is required'),
  section: z.enum(['summit', 'hackathon', 'foundation']),
  description: z.string().min(1, 'description is required'),
  heading: z.string().min(1, 'heading is required'),
  introParagraph: z.string().nullable().optional(),
  locale: z.string(),
  localizes: z.string().optional()
})
export type FaqFrontmatterType = z.infer<typeof faqFrontmatterSchema>

// Legacy export for backward compatibility
export const pageFrontmatterSchema = foundationPageFrontmatterSchema
