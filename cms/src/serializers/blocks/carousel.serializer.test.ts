import { describe, it, expect } from 'vitest'
import { serialize } from './carousel.serializer'

describe('carousel serializer', () => {
  it('serializes heading, accessibilityLabel, and logos', () => {
    const result = serialize({
      heading: 'In partnership with',
      accessibilityLabel: 'Our Partners',
      logos: [{ id: 1, url: '/img/plata.png', alternativeText: 'Plata' }]
    })

    expect(result).toContain('heading="In partnership with"')
    expect(result).toContain('accessibilityLabel="Our Partners"')
    expect(result).toContain(
      'logos={[{"name":"Plata","src":"/img/plata.png"}]}'
    )
  })

  it('serializes a null alternativeText as an empty string name', () => {
    const result = serialize({
      accessibilityLabel: 'Our Partners',
      logos: [{ id: 1, url: '/img/plata.png', alternativeText: null }]
    })

    expect(result).toContain('logos={[{"name":"","src":"/img/plata.png"}]}')
  })

  it('omits heading when absent', () => {
    const result = serialize({
      accessibilityLabel: 'Our Partners',
      logos: [{ id: 1, url: '/img/plata.png', alternativeText: 'Plata' }]
    })

    expect(result).not.toContain('heading=')
    expect(result).toContain('accessibilityLabel="Our Partners"')
  })

  it('throws when logos is missing', () => {
    expect(() =>
      serialize({
        heading: 'In partnership with',
        accessibilityLabel: 'Our Partners'
      })
    ).toThrow('Carousel block is missing logos')
  })

  it('throws when logos is an empty array', () => {
    expect(() =>
      serialize({ accessibilityLabel: 'Our Partners', logos: [] })
    ).toThrow('Carousel block is missing logos')
  })

  it('throws when accessibilityLabel is missing', () => {
    expect(() =>
      serialize({
        logos: [{ id: 1, url: '/img/plata.png', alternativeText: 'Plata' }]
      })
    ).toThrow('Carousel block is missing accessibilityLabel')
  })
})
