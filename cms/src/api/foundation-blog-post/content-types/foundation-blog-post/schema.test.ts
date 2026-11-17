import { describe, it, expect } from 'vitest'
import { pathSlugFormatError, toCanonicalPathSlug } from '@/utils'
import schema from './schema.json'

// pathSlug is a uid, and without a `regex` Strapi rejects `/` in a uid. The
// admin checks the regex against what the editor typed, before the save hook
// can correct it, and shows a generic message. So the regex only asks for a
// value, and validatePathSlugFormat applies the real rule with our message
// after the save hook ran (INTORG-574).
const pathSlugPattern = new RegExp(schema.attributes.pathSlug.regex)

describe('foundation-blog-post pathSlug regex', () => {
  it.each(['my-post', '/my-post/', 'My Post', 'my_post', 'my-post?x=1'])(
    'lets the editor save %j for the save hook to correct or name',
    (slug) => {
      expect(pathSlugPattern.test(slug)).toBe(true)
    }
  )

  it('rejects an empty value', () => {
    expect(pathSlugPattern.test('')).toBe(false)
  })

  // The admin pre-fills a required uid before there is a title, with the
  // content type's name: /foundation-blog-post/. Editors typed after it and
  // got a nested slug the /blog/[id] route can't build. Save requires the
  // slug instead (validatePathSlugOnSave).
  it('is not `required`, so the admin leaves it empty', () => {
    expect(schema.attributes.pathSlug).not.toHaveProperty('required')
  })

  it.each([
    ['My Post', '/my-post/'],
    ['my_post', '/my-post/'],
    ['//my-post/', '/my-post/']
  ])('stores %j as %j', (typed, stored) => {
    expect(toCanonicalPathSlug(typed)).toBe(stored)
    expect(pathSlugFormatError(typed)).toBeUndefined()
  })

  it.each(['my-post?x=1', 'my-post#top', 'my_post.v2~draft'])(
    'names what is wrong with %j',
    (slug) => {
      expect(pathSlugFormatError(slug)).toMatch(/^Path Slug /)
    }
  )
})
