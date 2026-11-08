import { describe, expect, it } from 'vitest'
import schema from '../components/shared/related-article.json'
import {
  RELATED_ARTICLE_SLUG_CUSTOM_FIELD,
  relatedArticleFieldError,
  relatedArticleSlugError,
  visibleRelatedArticleSlugError
} from './relatedArticleSlug'

describe('related article slug field', () => {
  it('is a custom field, so the admin can explain a /blog/ path', () => {
    expect(schema.attributes.slug).toMatchObject({
      type: 'customField',
      customField: RELATED_ARTICLE_SLUG_CUSTOM_FIELD,
      required: true
    })
    expect(schema.attributes.slug).not.toHaveProperty('regex')
  })
})

describe('relatedArticleSlugError', () => {
  it('names the blog path a grant URL has to match', () => {
    expect(
      relatedArticleSlugError('/grant/eoi-call-for-papers-reviewer/')
    ).toBe('Related Articles: should be a blog path, like /blog/my-post/.')
  })

  it.each([
    ['interledger-universe', '/blog/interledger-universe/'],
    ['/interledger-universe/', '/blog/interledger-universe/'],
    ['/my-post/', '/blog/my-post/'],
    // A grant slug is one segment too. The old stored form is the same shape,
    // so a save cannot tell a new value from a row sync has not rewritten.
    ['/eoi-call-for-papers-reviewer/', '/blog/eoi-call-for-papers-reviewer/'],
    ['/grant-slug', '/blog/grant-slug/']
  ])('rejects a single segment (%s)', (slug, suggestion) => {
    expect(relatedArticleSlugError(slug)).toBe(
      `Related Articles: should be a blog path, like ${suggestion}.`
    )
  })

  it('keeps the slug from a pasted blog URL', () => {
    expect(
      relatedArticleSlugError(
        'https://interledger.org/blog/call-papers-program/'
      )
    ).toBe(
      'Related Articles: should be a blog path, like /blog/call-papers-program/.'
    )
  })

  it('accepts a /blog/ path with or without its trailing slash', () => {
    expect(relatedArticleSlugError('/blog/my-post/')).toBeUndefined()
    expect(relatedArticleSlugError('/blog/my-post')).toBeUndefined()
  })
})

describe('visibleRelatedArticleSlugError', () => {
  it('stays quiet while the editor is still typing', () => {
    expect(
      visibleRelatedArticleSlugError('/grant/foo/', undefined, false)
    ).toBeUndefined()
  })

  it('explains a bad path once the field has been left', () => {
    expect(visibleRelatedArticleSlugError('/grant/foo/', undefined, true)).toBe(
      'Related Articles: should be a blog path, like /blog/my-post/.'
    )
  })

  it('shows the blog-path message after a failed save', () => {
    const serverError =
      'Related Articles: should be a blog path, like /blog/my-post/.'
    expect(
      visibleRelatedArticleSlugError('/grant/foo/', undefined, false)
    ).toBeUndefined()
    expect(
      visibleRelatedArticleSlugError('/grant/foo/', serverError, false)
    ).toBe(serverError)
  })

  it.each(['/my-post/', '/eoi-call-for-papers-reviewer/', '/grant-slug'])(
    'rejects %s in the admin field after a save',
    (slug) => {
      const segment = slug.replace(/^\/|\/$/g, '')
      expect(
        visibleRelatedArticleSlugError(
          slug,
          'Related Articles: Slug is required',
          false
        )
      ).toBe(`Related Articles: should be a blog path, like /blog/${segment}/.`)
    }
  )

  it('leaves an empty field to the required error', () => {
    expect(
      visibleRelatedArticleSlugError('', 'This value is required.', true)
    ).toBe('This value is required.')
  })

  it('does not invent an error for a valid path', () => {
    expect(
      relatedArticleFieldError('/blog/my-post/', undefined)
    ).toBeUndefined()
  })
})
