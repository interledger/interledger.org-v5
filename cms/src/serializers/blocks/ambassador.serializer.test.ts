import { describe, it, expect } from 'vitest'
import { serialize } from './ambassador.serializer'

const baseAmbassador = {
  name: 'Alice Example',
  slug: 'alice-example',
  description: 'A great ambassador.',
  photo: {
    id: 1,
    url: '/uploads/alice.jpg',
    alternativeText: 'Alice smiling'
  },
  linkedinUrl: 'https://linkedin.com/in/alice',
  grantReportUrl: 'https://example.com/report'
}

describe('ambassador serializer', () => {
  it('serializes ambassador with all props', () => {
    const result = serialize({ ambassador: baseAmbassador })

    expect(result).toContain('name="Alice Example"')
    expect(result).toContain('slug="alice-example"')
    expect(result).toContain('description="A great ambassador."')
    expect(result).toContain('photo="')
    expect(result).toContain('photoAlt="Alice smiling"')
    expect(result).toContain('linkedinUrl="https://linkedin.com/in/alice"')
    expect(result).toContain('grantReportUrl="https://example.com/report"')
  })

  it('returns empty string when ambassador is null', () => {
    expect(serialize({ ambassador: null })).toBe('')
  })

  it('returns empty string when ambassador is undefined', () => {
    expect(serialize({})).toBe('')
  })

  it('emits showLinks={false} when false', () => {
    const result = serialize({ ambassador: baseAmbassador, showLinks: false })

    expect(result).toContain('showLinks={false}')
  })

  it('omits showLinks when true (default)', () => {
    const result = serialize({ ambassador: baseAmbassador, showLinks: true })

    expect(result).not.toContain('showLinks')
  })

  it('omits showLinks when undefined', () => {
    const result = serialize({ ambassador: baseAmbassador })

    expect(result).not.toContain('showLinks')
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

  it('falls back to empty string when photo has no alternativeText', () => {
    const result = serialize({
      ambassador: {
        ...baseAmbassador,
        photo: { id: 1, url: '/uploads/alice.jpg' }
      }
    })

    expect(result).toContain('photoAlt=""')
  })

  it('handles missing optional fields', () => {
    const result = serialize({
      ambassador: {
        name: 'Bob',
        slug: 'bob',
        photo: null,
        linkedinUrl: null,
        grantReportUrl: null
      }
    })

    expect(result).toContain('name="Bob"')
    expect(result).toContain('slug="bob"')
    expect(result).toContain('linkedinUrl=""')
    expect(result).toContain('grantReportUrl=""')
  })
})
