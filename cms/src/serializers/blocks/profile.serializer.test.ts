import { describe, it, expect } from 'vitest'
import { serialize } from './profile.serializer'

const baseProfile = {
  name: 'Alice Example',
  pathSlug: 'alice-example',
  description: 'A great profile.',
  media: {
    image: {
      id: 1,
      url: '/uploads/alice.jpg'
    },
    alternativeText: 'Alice smiling'
  },
  category: 'Fellows 2026',
  tagline: 'Tagline of Alice'
}

describe('profile serializer', () => {
  it('serializes profile with all props', () => {
    const result = serialize({ profile: baseProfile })

    expect(result).toContain('name="Alice Example"')
    expect(result).toContain('pathSlug="alice-example"')
    expect(result).toContain('photo="/uploads/alice.jpg"')
    expect(result).toContain('photoAlt="Alice smiling"')
    expect(result).toContain('tagline="Tagline of Alice"')
  })

  it('returns empty string when profile is null', () => {
    expect(serialize({ profile: null })).toBe('')
  })

  it('returns empty string when profile is undefined', () => {
    expect(serialize({})).toBe('')
  })

  it('emits correct photoAlt from media.alternativeText', () => {
    const result = serialize({
      profile: {
        ...baseProfile,
        media: {
          image: { id: 1, url: '/uploads/alice.jpg' },
          alternativeText: 'Portrait of Alice'
        }
      }
    })

    expect(result).toContain('photoAlt="Portrait of Alice"')
  })

  it('omits photoAlt when media has no alternativeText', () => {
    const result = serialize({
      profile: {
        ...baseProfile,
        media: { image: { id: 1, url: '/uploads/alice.jpg' } }
      }
    })

    expect(result).not.toContain('photoAlt=')
  })

  it('emits photoAlt="" when alternativeText is explicitly empty (decorative image)', () => {
    const result = serialize({
      profile: {
        ...baseProfile,
        media: {
          image: { id: 1, url: '/uploads/alice.jpg' },
          alternativeText: ''
        }
      }
    })

    expect(result).toContain('photoAlt=""')
  })

  it('handles missing optional fields', () => {
    const result = serialize({
      profile: {
        name: 'Bob',
        pathSlug: 'bob',
        media: null,
        category: null,
        tagline: null,
        description: null
      }
    })

    expect(result).toContain('name="Bob"')
    expect(result).toContain('pathSlug="bob"')
    expect(result).not.toContain('photo=')
    expect(result).toContain('tagline=""')
  })
})
