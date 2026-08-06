import { describe, it, expect } from 'vitest'
import { serialize } from './carousel.serializer'

describe('carousel serializer', () => {
  it('serializes heading, accessibilityLabel, and logos', () => {
    const result = serialize({
      heading: 'In partnership with',
      accessibilityLabel: 'Our Partners',
      logos: [{ image: { url: '/img/plata.png' }, alternativeText: 'Plata' }]
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
      logos: [{ image: { url: '/img/plata.png' }, alternativeText: null }]
    })

    expect(result).toContain('logos={[{"name":"","src":"/img/plata.png"}]}')
  })

  it('omits heading when absent', () => {
    const result = serialize({
      accessibilityLabel: 'Our Partners',
      logos: [{ image: { url: '/img/plata.png' }, alternativeText: 'Plata' }]
    })

    expect(result).not.toContain('heading=')
    expect(result).toContain('accessibilityLabel="Our Partners"')
  })

  it('supports legacy plain-media logo shape', () => {
    const result = serialize({
      accessibilityLabel: 'Our Partners',
      logos: [{ id: 1, url: '/img/plata.png', alternativeText: 'Plata' }]
    })
    expect(result).toContain(
      'logos={[{"name":"Plata","src":"/img/plata.png"}]}'
    )
  })

  it('accepts bare image upload ids (validateContentBlocks write body)', () => {
    const result = serialize({
      accessibilityLabel: 'Our Partners',
      logos: [{ image: 12, alternativeText: 'Plata' }]
    })
    expect(result).toContain('accessibilityLabel="Our Partners"')
    expect(result).toContain('logos={[{"name":"Plata","src":""}]}')
  })

  it('throws when a logo has no image', () => {
    expect(() =>
      serialize({
        accessibilityLabel: 'Our Partners',
        logos: [{ image: null, alternativeText: 'Plata' }]
      })
    ).toThrow('Carousel logo is missing image')
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
        logos: [{ image: { url: '/img/plata.png' }, alternativeText: 'Plata' }]
      })
    ).toThrow('Carousel block is missing accessibilityLabel')
  })
})
