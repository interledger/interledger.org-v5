import matter from 'gray-matter'
import { describe, expect, it, vi } from 'vitest'
import {
  generateBlogMDX,
  generateFaqMdx,
  generateProfileMdx,
  generateReportMdx
} from '@/utils'
import {
  buildBlogPayload,
  buildFaqPayload,
  buildGrantOverviewPagePayload,
  buildGrantPagePayload,
  buildHackathonPagePayload,
  buildPagePayload,
  buildProfilePayload,
  buildReportPayload,
  type StrapiUploadContext
} from './mdxTransformer'
import {
  faqFrontmatterSchema,
  foundationBlogFrontmatterSchema,
  foundationPageFrontmatterSchema,
  grantOverviewPageFrontmatterSchema,
  grantPageFrontmatterSchema,
  hackathonPageFrontmatterSchema,
  profileFrontmatterSchema,
  reportFrontmatterSchema,
  summitPageFrontmatterSchema
} from './siteSchemas'
import type { StrapiClient } from './strapiClient'
import { createMdxFile } from './test-utils'
import type { MDXFile } from './mdxTypes'

// The `draft` checkbox must survive both directions: Strapi writes
// `draft: true` into the MDX only when checked, and sync must send an explicit
// boolean so that removing the key from a file clears the box in Strapi.

const strapiClient = {
  findUploadByUrl: vi.fn().mockResolvedValue(null),
  findUploadByName: vi.fn().mockResolvedValue(null),
  updateUploadAlt: vi.fn().mockResolvedValue(undefined)
} as unknown as StrapiClient

const uploadContext: StrapiUploadContext = {
  strapi: strapiClient,
  STRAPI_URL: 'http://localhost:1337',
  STRAPI_TOKEN: 'token',
  dryRun: true
}

const page = { title: 'Page', description: 'A description.', locale: 'en' }
const ctaStrip = { buttonText: 'Apply', buttonLink: '/apply/' }
const faqSections = [
  { heading: 'General', items: [{ question: 'Why?', answer: 'Because.' }] }
]

type BuildPayload = (mdx: MDXFile) => Promise<Record<string, unknown> | Error>

const builders: [string, BuildPayload, Record<string, unknown>][] = [
  [
    'foundation page',
    (mdx) => buildPagePayload(foundationPageFrontmatterSchema, mdx),
    page
  ],
  [
    'summit page',
    (mdx) => buildPagePayload(summitPageFrontmatterSchema, mdx),
    page
  ],
  [
    'hackathon page',
    (mdx) => buildHackathonPagePayload(hackathonPageFrontmatterSchema, mdx),
    page
  ],
  [
    'grant page',
    (mdx) => buildGrantPagePayload(grantPageFrontmatterSchema, mdx),
    { ...page, ctaStrip }
  ],
  [
    'grant overview page',
    (mdx) =>
      buildGrantOverviewPagePayload(grantOverviewPageFrontmatterSchema, mdx),
    { ...page, ctaStrip }
  ],
  [
    'faq',
    (mdx) => buildFaqPayload(faqFrontmatterSchema, mdx),
    { ...page, section: 'foundation', heading: 'FAQ', faqSections }
  ],
  [
    'report',
    (mdx) => buildReportPayload(reportFrontmatterSchema, mdx),
    { ...page, section: 'foundation', heading: 'Report' }
  ],
  [
    'profile',
    (mdx) => buildProfilePayload(profileFrontmatterSchema, mdx, strapiClient),
    { name: 'Jane Doe', section: 'foundation', photo: null, locale: 'en' }
  ],
  [
    'blog post',
    (mdx) =>
      buildBlogPayload(foundationBlogFrontmatterSchema, mdx, uploadContext),
    {
      ...page,
      date: '2026-06-10',
      relatedArticles: ['one', 'two', 'three']
    }
  ]
]

async function draftInPayload(
  build: BuildPayload,
  frontmatter: Record<string, unknown>
): Promise<unknown> {
  const payload = await build(createMdxFile({ pathSlug: 'test', frontmatter }))
  if (payload instanceof Error) throw payload
  return payload.draft
}

describe('sync payload — draft', () => {
  it.each(builders)(
    '%s sends draft: true from frontmatter',
    async (_, build, frontmatter) => {
      expect(await draftInPayload(build, { ...frontmatter, draft: true })).toBe(
        true
      )
    }
  )

  it.each(builders)(
    '%s sends draft: false when the key is missing, clearing the box',
    async (_, build, frontmatter) => {
      expect(await draftInPayload(build, frontmatter)).toBe(false)
    }
  )
})

describe('Strapi → MDX → Strapi — draft', () => {
  function mdxFromGenerated(generated: string): MDXFile {
    const { data, content } = matter(generated)
    return createMdxFile({
      pathSlug: String(data.pathSlug),
      frontmatter: data,
      content
    })
  }

  const exporters: [string, (draft: boolean) => Promise<string> | string][] = [
    [
      'faq',
      (draft) =>
        generateFaqMdx({
          title: 'FAQ',
          pathSlug: 'faq',
          section: 'foundation',
          heading: 'FAQ',
          description: 'A description.',
          faqSections,
          locale: 'en',
          draft
        })
    ],
    [
      'profile',
      (draft) =>
        generateProfileMdx({
          name: 'Jane Doe',
          pathSlug: 'team/jane-doe',
          section: 'foundation',
          locale: 'en',
          draft
        })
    ],
    [
      'report',
      (draft) =>
        generateReportMdx({
          title: 'Report',
          pathSlug: 'report',
          section: 'foundation',
          heading: 'Report',
          description: 'A description.',
          locale: 'en',
          draft
        })
    ],
    [
      'blog post',
      (draft) =>
        generateBlogMDX({
          id: 1,
          documentId: 'doc1',
          title: 'Post',
          description: 'A description.',
          pathSlug: 'post',
          date: '2026-06-10',
          featured: false,
          content: 'Body.',
          createdAt: new Date('2026-06-10'),
          updatedAt: new Date('2026-06-10'),
          locale: 'en',
          categories: [],
          relatedArticles: [
            { slug: 'one' },
            { slug: 'two' },
            { slug: 'three' }
          ],
          localizations: [],
          draft
        } as unknown as Parameters<typeof generateBlogMDX>[0])
    ]
  ]

  function builderFor(name: string): BuildPayload {
    const entry = builders.find(([builderName]) => builderName === name)
    if (!entry) throw new Error(`No payload builder for ${name}`)
    return entry[1]
  }

  it.each(exporters)(
    '%s keeps a checked box checked',
    async (name, generate) => {
      const mdx = mdxFromGenerated(await generate(true))

      expect(mdx.frontmatter.draft).toBe(true)
      expect(await draftInPayload(builderFor(name), mdx.frontmatter)).toBe(true)
    }
  )

  it.each(exporters)(
    '%s keeps an unchecked box unchecked, with no key in the file',
    async (name, generate) => {
      const mdx = mdxFromGenerated(await generate(false))

      expect(mdx.frontmatter).not.toHaveProperty('draft')
      expect(await draftInPayload(builderFor(name), mdx.frontmatter)).toBe(
        false
      )
    }
  )
})
