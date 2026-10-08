import { describe, it, expect } from 'vitest'
import { toSlashedSlug } from '@/utils'
import schema from './schema.json'

// pathSlug is a uid, and without a `regex` Strapi rejects `/` in a uid on
// publish. The admin validates what the editor typed (or what Generate made
// from the title), the server validates what the save hook stored.
const pathSlugPattern = new RegExp(schema.attributes.pathSlug.regex)

describe('foundation-blog-post pathSlug regex', () => {
  it.each(['my-post', 'my_post.v2~draft'])(
    'accepts the generated slug %j and its stored form',
    (slug) => {
      expect(pathSlugPattern.test(slug)).toBe(true)
      expect(pathSlugPattern.test(toSlashedSlug(slug))).toBe(true)
    }
  )

  it.each(['', '/', '//my-post/', 'my post', 'my-post?x=1', 'my-post#top'])(
    'rejects %j',
    (slug) => {
      expect(pathSlugPattern.test(slug)).toBe(false)
    }
  )
})
