import { describe, it, expect } from 'vitest'
import { serialize } from './split-layout.serializer'

describe('split-layout serializer', () => {
  it('serializes left image position so Strapi publishes update MDX', () => {
    const result = serialize({
      imagePosition: 'left',
      image: {
        url: '/uploads/education_grant.jpg',
        alternativeText: 'Students collaborating'
      },
      content: 'Some body copy.'
    })

    expect(result).toContain('imagePosition="left"')
  })

  it('omits image position when it is the default right value', () => {
    const result = serialize({
      imagePosition: 'right',
      image: { url: '/uploads/education_grant.jpg' },
      content: 'Some body copy.'
    })

    expect(result).not.toContain('imagePosition=')
  })
})
