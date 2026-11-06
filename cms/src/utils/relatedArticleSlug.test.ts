import { describe, expect, it } from 'vitest'
import schema from '../components/shared/related-article.json'
import {
  RELATED_ARTICLE_SLUG_CUSTOM_FIELD,
  relatedArticleFieldError,
  relatedArticleSlugError,
  visibleRelatedArticleSlugError
} from './relatedArticleSlug'

const GENERIC_REGEX_ERROR = 'The value does not match the regex.'

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
    ).toBe('This value should be a blog path, like /blog/my-post/.')
  })

  it('keeps the slug from a pasted blog URL', () => {
    expect(
      relatedArticleSlugError(
        'https://interledger.org/blog/call-papers-program/'
      )
    ).toBe('This value should be a blog path, like /blog/call-papers-program/.')
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

  it('replaces the shared regex error once the field has been left', () => {
    expect(
      visibleRelatedArticleSlugError('/grant/foo/', GENERIC_REGEX_ERROR, true)
    ).toBe('This value should be a blog path, like /blog/my-post/.')
  })

  it('shows the blog-path message after a failed save', () => {
    expect(
      visibleRelatedArticleSlugError('two', undefined, false)
    ).toBeUndefined()
    expect(visibleRelatedArticleSlugError('two', 'saved', false)).toBe(
      'This value should be a blog path, like /blog/my-post/.'
    )
  })

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
