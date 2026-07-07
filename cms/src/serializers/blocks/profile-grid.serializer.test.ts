import { describe, it, expect } from 'vitest'
import { serialize } from './profile-grid.serializer'

describe('profile-grid serializer', () => {
  it('serializes a category-only grid', () => {
    const result = serialize({ category: '2025 Hackathon Judges' })
    expect(result).toBe('<ProfileGrid category="2025 Hackathon Judges" />')
  })

  it('includes the heading attribute when provided', () => {
    const result = serialize({
      heading: 'Meet the judges',
      category: '2025 Hackathon Judges'
    })
    expect(result).toBe(
      '<ProfileGrid heading="Meet the judges" category="2025 Hackathon Judges" />'
    )
  })

  it('escapes attribute values', () => {
    const result = serialize({ heading: 'A & B', category: 'C > D' })
    expect(result).toContain('heading="A &amp; B"')
    expect(result).toContain('category="C &gt; D"')
  })

  it('serializes manually picked profiles as pathSlugs, preserving order', () => {
    const result = serialize({
      profiles: [
        { name: 'Alice', pathSlug: 'alice' },
        { name: 'Bob', pathSlug: 'bob' }
      ]
    })
    expect(result).toBe("<ProfileGrid pathSlugs={['alice','bob']} />")
  })

  it('omits category when manual profiles are selected', () => {
    const result = serialize({
      heading: 'Team',
      category: 'ambassador1',
      profiles: [{ name: 'Alice', pathSlug: 'alice' }]
    })
    expect(result).toBe(
      '<ProfileGrid heading="Team" pathSlugs={[\'alice\']} />'
    )
  })

  it('omits profiles missing a pathSlug', () => {
    const result = serialize({
      profiles: [
        { name: 'Alice', pathSlug: 'alice' },
        { name: 'No Slug', pathSlug: '' }
      ]
    })
    expect(result).toBe("<ProfileGrid pathSlugs={['alice']} />")
  })

  it('renders with neither category nor profiles', () => {
    const result = serialize({ heading: 'Empty' })
    expect(result).toBe('<ProfileGrid heading="Empty" />')
  })
})
