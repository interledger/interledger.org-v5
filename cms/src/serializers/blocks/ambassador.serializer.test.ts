import { describe, it, expect } from 'vitest'
import { serialize } from './ambassador.serializer'

const baseAmbassador = {
  name: 'Alice Example',
  pathSlug: 'alice-example',
  description: 'A great ambassador.',
  photo: {
    id: 1,
    url: '/uploads/alice.jpg',
    alternativeText: 'Alice smiling'
  },
  category: 'Fellows 2026',
  tagline: 'Tagline of Alice',
  quote: 'Something Alice said'
}

describe('ambassador serializer', () => {
  it('serializes ambassador with all props', () => {
    const result = serialize({ ambassador: baseAmbassador })

    expect(result).toContain('name="Alice Example"')
    expect(result).toContain('pathSlug="alice-example"')
    expect(result).toContain('photo="')
    expect(result).toContain('photoAlt="Alice smiling"')
    expect(result).toContain('quote="Something Alice said"')
  })

  it('returns empty string when ambassador is null', () => {
    expect(serialize({ ambassador: null })).toBe('')
  })

  it('returns empty string when ambassador is undefined', () => {
    expect(serialize({})).toBe('')
  })

  it('emits correct photoAlt from photo.alternativeText', () => {
    const result = serialize({
      ambassador: {
        ...baseAmbassador,
        photo: {
          id: 1,
          url: '/uploads/alice.jpg',
          alternativeText: 'Portrait of Alice'
        }
      }
    })

    expect(result).toContain('photoAlt="Portrait of Alice"')
  })

  it('omits photoAlt when photo has no alternativeText', () => {
    const result = serialize({
      ambassador: {
        ...baseAmbassador,
        photo: { id: 1, url: '/uploads/alice.jpg' }
      }
    })

    expect(result).not.toContain('photoAlt=')
  })

  it('emits photoAlt="" when alternativeText is explicitly empty (decorative image)', () => {
    const result = serialize({
      ambassador: {
        ...baseAmbassador,
        photo: { id: 1, url: '/uploads/alice.jpg', alternativeText: '' }
      }
    })

    expect(result).toContain('photoAlt=""')
  })

  it('handles missing optional fields', () => {
    const result = serialize({
      ambassador: {
        name: 'Bob',
        pathSlug: 'bob',
        photo: null,
        category: null,
        tagline: null,
        quote: null,
        description: null
      }
    })

    expect(result).toContain('name="Bob"')
    expect(result).toContain('pathSlug="bob"')
    expect(result).toContain('quote=""')
  })
})
