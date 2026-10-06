import { describe, it, expect } from 'vitest'
import {
  migrateFrontmatterPaths,
  migrateNavigationHrefs,
  migrateRedirectConfig
} from './migrateSlashedPaths'

function mdx(frontmatter: string, body = '\nBody with [a link](/about).\n') {
  return `---\n${frontmatter}\n---\n${body}`
}

describe('migrateFrontmatterPaths', () => {
  it('slashes pathSlug and localizes, keeping their quotes', () => {
    const raw = mdx(
      "title: 'About'\npathSlug: 'grant/fellowship'\nlocalizes: about"
    )

    expect(migrateFrontmatterPaths(raw)).toBe(
      mdx("title: 'About'\npathSlug: '/grant/fellowship/'\nlocalizes: /about/")
    )
  })

  it('slashes every relatedArticles item and nothing after the list', () => {
    const raw = mdx(
      "relatedArticles:\n  - 'one'\n  - \"/two\"\n  - three\ncategories:\n  - 'News'"
    )

    expect(migrateFrontmatterPaths(raw)).toBe(
      mdx(
        "relatedArticles:\n  - '/one/'\n  - \"/two/\"\n  - /three/\ncategories:\n  - 'News'"
      )
    )
  })

  it('slashes internal links at any depth and leaves the rest alone', () => {
    const raw = mdx(
      [
        'hero:',
        '  cta:',
        "    link: '/grant/apply'",
        '    external: false',
        "buttonLink: '/es/grant/grantmaking-faq'",
        "ctaLink: '#XVSHSPQU'",
        "secondaryButtonLink: 'https://example.com/x'",
        "authorLink: 'mailto:a@b.org'",
        "  link: '/uploads/img/original/report.pdf'"
      ].join('\n')
    )

    expect(migrateFrontmatterPaths(raw)).toBe(
      mdx(
        [
          'hero:',
          '  cta:',
          "    link: '/grant/apply/'",
          '    external: false',
          "buttonLink: '/es/grant/grantmaking-faq/'",
          "ctaLink: '#XVSHSPQU'",
          "secondaryButtonLink: 'https://example.com/x'",
          "authorLink: 'mailto:a@b.org'",
          "  link: '/uploads/img/original/report.pdf'"
        ].join('\n')
      )
    )
  })

  // Body links are a separate change; the frontmatter pass must not reach them.
  it('leaves the body untouched', () => {
    const raw = mdx('pathSlug: about', '\n[x](/about)\nlink: /about\n')

    expect(migrateFrontmatterPaths(raw)).toBe(
      mdx('pathSlug: /about/', '\n[x](/about)\nlink: /about\n')
    )
  })

  it('returns null when everything is already slashed', () => {
    expect(
      migrateFrontmatterPaths(mdx("pathSlug: '/about/'\nlink: '/team/'"))
    ).toBeNull()
  })

  it('reads frontmatter behind a byte-order mark', () => {
    expect(migrateFrontmatterPaths(`\uFEFF${mdx('pathSlug: about')}`)).toBe(
      `\uFEFF${mdx('pathSlug: /about/')}`
    )
  })

  it('returns null for a file without frontmatter', () => {
    expect(migrateFrontmatterPaths('# Just a heading\n')).toBeNull()
  })
})

describe('migrateNavigationHrefs', () => {
  it('slashes internal hrefs anywhere in the tree', () => {
    const tree = {
      mainMenu: [
        {
          label: 'Tech',
          href: '/tech',
          items: [
            { label: 'Portal', href: '/tech/dev-portal/' },
            { label: 'Ext', href: 'https://example.com' }
          ]
        }
      ],
      ctaButton: { label: 'Donate', href: '/donate' }
    }

    migrateNavigationHrefs(tree)

    expect(tree).toEqual({
      mainMenu: [
        {
          label: 'Tech',
          href: '/tech/',
          items: [
            { label: 'Portal', href: '/tech/dev-portal/' },
            { label: 'Ext', href: 'https://example.com' }
          ]
        }
      ],
      ctaButton: { label: 'Donate', href: '/donate/' }
    })
  })
})

describe('migrateRedirectConfig', () => {
  it('slashes sources and on-site destinations, in Strapi sort order', () => {
    const result = migrateRedirectConfig({
      site_pages: [
        { source: '/about', destination: '/about-us', status: 301 },
        { source: '/about-old', destination: '/team?x=1', status: 302 },
        {
          source: '/docs',
          destination: 'https://example.org/docs',
          status: 301,
          enabled: false,
          note: 'kept'
        }
      ]
    })

    expect(result).not.toBeInstanceOf(Error)
    expect((result as { site_pages: unknown[] }).site_pages).toEqual([
      { source: '/about-old/', destination: '/team/?x=1', status: 302 },
      { source: '/about/', destination: '/about-us/', status: 301 },
      {
        source: '/docs/',
        destination: 'https://example.org/docs',
        status: 301,
        enabled: false,
        note: 'kept'
      }
    ])
  })
})
