const { describe, it, expect } = require('bun:test')

const { buildEntryData, getEntryField } = require('../sync')

describe('getEntryField', () => {
  it('returns top-level field for Strapi v5 flat response', () => {
    const entry = { documentId: 'doc-1', slug: 'hello', content: '<p>Hi</p>' }
    expect(getEntryField(entry, 'content')).toBe('<p>Hi</p>')
    expect(getEntryField(entry, 'slug')).toBe('hello')
  })

  it('falls back to attributes for Strapi v4-style response', () => {
    const entry = { attributes: { content: '<p>Legacy</p>' } }
    expect(getEntryField(entry, 'content')).toBe('<p>Legacy</p>')
  })

  it('returns null for missing field', () => {
    expect(getEntryField({ slug: 'x' }, 'content')).toBeNull()
    expect(getEntryField(null, 'content')).toBeNull()
  })
})

describe('buildEntryData', () => {
  it('builds paragraph content for pages from MDX body', () => {
    const mdx = {
      frontmatter: { title: 'Hello' },
      slug: 'hello',
      content: '# Hi there'
    }
    const data = buildEntryData('foundation-pages', mdx)
    expect(Array.isArray(data.content)).toBe(true)
    expect(data.content[0].__component).toBe('blocks.paragraph')
    expect(data.content[0].content).toContain('<h1>Hi there</h1>')
  })

  it('preserves existing content when MDX body is empty', () => {
    const mdx = {
      frontmatter: { title: 'Hello' },
      slug: 'hello',
      content: '   '
    }
    const existingEntry = {
      attributes: {
        content: [{ __component: 'blocks.paragraph', content: '<p>Keep</p>' }]
      }
    }
    const data = buildEntryData('foundation-pages', mdx, existingEntry)
    expect(data.content).toEqual(existingEntry.attributes.content)
  })

  it('preserves hero when not provided', () => {
    const mdx = {
      frontmatter: { title: 'Summit' },
      slug: 'summit',
      content: 'Body'
    }
    const existingEntry = {
      attributes: {
        hero: { title: 'Existing', description: 'Keep' }
      }
    }
    const data = buildEntryData('summit-pages', mdx, existingEntry)
    expect(data.hero).toEqual(existingEntry.attributes.hero)
  })

  it('builds hero from frontmatter when provided', () => {
    const mdx = {
      frontmatter: {
        title: 'Foundation',
        heroTitle: 'Hero Title',
        heroDescription: 'Hero Description'
      },
      slug: 'foundation',
      content: 'Body'
    }
    const data = buildEntryData('foundation-pages', mdx)
    expect(data.hero).toEqual({
      title: 'Hero Title',
      description: 'Hero Description'
    })
  })

  it('builds blog entries with HTML content and publishedAt', () => {
    const mdx = {
      frontmatter: {
        title: 'Blog Title',
        description: 'Blog Desc',
        date: '2026-01-01'
      },
      slug: 'blog-title',
      content: 'Hello **world**'
    }
    const data = buildEntryData('blog', mdx)
    expect(data.title).toBe('Blog Title')
    expect(data.description).toBe('Blog Desc')
    expect(data.slug).toBe('blog-title')
    expect(data.date).toBe('2026-01-01')
    expect(data.content).toContain('<p>')
    expect(typeof data.publishedAt).toBe('string')
  })
})
