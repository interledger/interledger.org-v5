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
  'Engineering',
  'Grantmaking',
  'Interledger Technology',
  'News',
  'Policy and Advocacy',
  'Thought Leadership'
] as const

export type BlogCategory = (typeof blogCategories)[number]

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
  heroTitle: z.string().trim().min(1, 'heroTitle cannot be blank').optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  heroImageMobile: z.string().optional(),
  heroCtas: z.array(heroCtaSchema).max(1).optional(),
  programOverview: z.string().optional(),
  primaryCta: z
    .object({
      text: z.string(),
      link: z.string(),
      external: z.boolean().optional()
    })
    .optional(),
  infoCards: grantInfoCardsSchema.optional(),
  faqSection: grantFaqSectionSchema.optional(),
  ctaStrip: grantCtaStripSchema,
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
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroImage: z.string().optional(),
  heroImageMobile: z.string().optional(),
  heroCtas: z.array(heroCtaSchema).max(1).optional(),
  ctaStrip: grantCtaStripSchema,
  metaImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
  localizes: z.string().optional(),
  locale: z.string().optional()
})

export type GrantOverviewPageFrontmatterType = z.infer<
  typeof grantOverviewPageFrontmatterSchema
>

// Site section for cross-section templates (profiles, reports, etc.). Controls
// routing and breadcrumbs only — never where the MDX file is stored on disk.
const sectionSchema = z.enum(['summit', 'hackathon', 'foundation'])

// Profile pages (ambassadors, judges, leadership, etc., grouped by the free-text
// `category` field). For `section: foundation`, pathSlug is the full site path
// (e.g. grant/fellowship/jane-doe, team/jane-doe). For summit or hackathon,
// pathSlug is relative to that section prefix (e.g. 2025/judges/jane-doe).
export const profileFrontmatterSchema = z.object({
  pathSlug: pathSlugSchema(),
  name: z.string().min(1, 'name is required'),
  section: sectionSchema,
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

const faqItemSchema = z.object({
  question: z.string().min(1, 'question is required'),
  answer: z.string().min(1, 'answer is required')
})

const faqSectionSchema = z.object({
  heading: z.string().min(1, 'heading is required'),
  items: z.array(faqItemSchema).min(1)
})

// FAQ pages. Cross-section template (see ADR-003): pathSlug is relative to
// whichever `section` the editor picks, e.g. for `foundation`, faq or
// grant/education/on-campus/faq.
export const faqFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  pathSlug: pathSlugSchema(),
  section: z.enum(['summit', 'hackathon', 'foundation']),
  heading: z.string().min(1, 'heading is required'),
  description: z.string().min(1, 'description is required'),
  introParagraph: z.string().nullable().optional(),
  faqSections: z.array(faqSectionSchema).min(1),
  locale: z.string(),
  localizes: z.string().optional()
})
export type FaqFrontmatterType = z.infer<typeof faqFrontmatterSchema>
export type FaqSectionType = z.infer<typeof faqSectionSchema>
export type FaqItemType = z.infer<typeof faqItemSchema>

// Optional publish/last-updated dates for a report. When present, publishDate
// is required; lastUpdated is only ever meaningful alongside a publishDate.
const reportDateSchema = z.object({
  publishDate: z.coerce.date(),
  lastUpdated: z.coerce.date().optional()
})

// Report/research pages. Cross-section template (see ADR-003): pathSlug is
// relative to whichever `section` the editor picks, e.g. for `foundation`,
// policy-and-advocacy/role-stablecoins-...
export const reportFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  pathSlug: pathSlugSchema(),
  section: sectionSchema,
  heading: z.string().min(1, 'heading is required'),
  description: z.string().min(1, 'description is required'),
  introParagraph: z.string().nullable().optional(),
  date: reportDateSchema.optional(),
  locale: z.string(),
  localizes: z.string().optional()
})
export type ReportFrontmatterType = z.infer<typeof reportFrontmatterSchema>

// Legacy export for backward compatibility
export const pageFrontmatterSchema = foundationPageFrontmatterSchema
