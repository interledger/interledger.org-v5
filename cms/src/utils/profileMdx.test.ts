import { describe, it, expect } from 'vitest'
import matter from 'gray-matter'
import { generateProfileMdx, type ProfileMdxInput } from './profileMdx'

function makeProfile(
  overrides: Partial<ProfileMdxInput> = {}
): ProfileMdxInput {
  return {
    name: 'Jane Doe',
    pathSlug: 'hackathon/2025/judges/jane-doe',
    category: '2025 Hackathon Judges',
    locale: 'en',
    ...overrides
  }
}

describe('generateProfileMdx', () => {
  it('writes core frontmatter fields and the body', () => {
    const mdx = generateProfileMdx(
      makeProfile({
        tagline: 'Engineer',
        content: [{ __component: 'blocks.paragraph', content: 'A short bio.' }]
      })
    )
    const { data, content } = matter(mdx)

    expect(data.name).toBe('Jane Doe')
    expect(data.pathSlug).toBe('hackathon/2025/judges/jane-doe')
    expect(data.category).toBe('2025 Hackathon Judges')
    expect(data.tagline).toBe('Engineer')
    expect(data.locale).toBe('en')
    expect(content.trim()).toContain('A short bio.')
  })

  it('serializes paragraph blocks from the content dynamic zone', () => {
    const { content } = matter(
      generateProfileMdx(
        makeProfile({
          content: [
            { __component: 'blocks.paragraph', content: 'A short bio.' }
          ]
        })
      )
    )
    expect(content).toContain('<Paragraph>')
    expect(content).toContain('A short bio.')
  })

  it('writes role to frontmatter', () => {
    const { data } = matter(
      generateProfileMdx(
        makeProfile({
          role: 'Open Web Advocate & Open Source Contributor'
        })
      )
    )
    expect(data.role).toBe('Open Web Advocate & Open Source Contributor')
  })

  it('writes photo as null when no photo is set, deriving alt from the name', () => {
    const { data } = matter(generateProfileMdx(makeProfile()))
    expect(data.photo).toBeNull()
    expect(data.photoAlt).toBe('Jane Doe')
  })

  it('serializes the CTA object, dropping the default primary style', () => {
    const mdx = generateProfileMdx(
      makeProfile({
        cta: { text: 'Read more', link: 'https://example.com', external: true }
      })
    )
    const { data } = matter(mdx)
    expect(data.cta).toEqual({
      text: 'Read more',
      link: 'https://example.com',
      external: true
    })
  })

  it('keeps an explicit secondary CTA style', () => {
    const { data } = matter(
      generateProfileMdx(
        makeProfile({
          cta: { text: 'Go', link: '/x', style: 'secondary' }
        })
      )
    )
    expect((data.cta as { style?: string }).style).toBe('secondary')
  })

  it('omits the CTA when text or link is missing', () => {
    const { data } = matter(
      generateProfileMdx(makeProfile({ cta: { text: 'No link' } }))
    )
    expect(data.cta).toBeUndefined()
  })

  it('adds localizes for a non-default locale, using the English slug', () => {
    const { data } = matter(
      generateProfileMdx(
        makeProfile({
          locale: 'es',
          pathSlug: 'hackathon/2025/jueces/jane-doe'
        }),
        'hackathon/2025/judges/jane-doe'
      )
    )
    expect(data.locale).toBe('es')
    expect(data.localizes).toBe('hackathon/2025/judges/jane-doe')
  })

  it('does not add localizes for the default locale', () => {
    const { data } = matter(generateProfileMdx(makeProfile()))
    expect(data.localizes).toBeUndefined()
  })
})
