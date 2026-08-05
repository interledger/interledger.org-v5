import { describe, it, expect } from 'vitest'
import { serialize } from './event-card.serializer'
import { SerializerFieldError } from '../../utils'

describe('event-card.serializer', () => {
  const when = {
    title: 'When?',
    date: 'November 8–9, 2025',
    time: '24h'
  }
  const where = {
    title: 'Where?',
    location:
      'InSpark C. Lago Zurich 119, Granad Miguel Hidalgo, 11529 Ciudad de Mexico, CDM'
  }
  const apply = {
    title: 'Apply',
    primaryCta: {
      text: 'Apply today',
      link: '/grants/apply',
      external: false
    }
  }

  it('serializes a three-column card', () => {
    const mdx = serialize({ when, where, apply })

    expect(mdx).toContain('<EventCard>')
    expect(mdx).toContain(
      '<EventWhen title="When?" date="November 8–9, 2025" time="24h" />'
    )
    expect(mdx).toContain('location=')
    expect(mdx).toContain(
      '<EventApply title="Apply" buttonText="Apply today" buttonUrl="/grants/apply" />'
    )
  })

  it('omits Apply when the column is absent', () => {
    const mdx = serialize({ when, where })

    expect(mdx).toContain('<EventWhen')
    expect(mdx).toContain('<EventWhere')
    expect(mdx).not.toContain('EventApply')
  })

  it('includes optional text as children', () => {
    const mdx = serialize({
      when: { ...when, text: 'Doors open early for speakers.' },
      where
    })

    expect(mdx).toContain('<EventWhen')
    expect(mdx).toContain('Doors open early for speakers.')
    expect(mdx).toContain('</EventWhen>')
  })

  it('serializes external Apply CTAs', () => {
    const mdx = serialize({
      when,
      where,
      apply: {
        title: 'Register',
        primaryCta: {
          text: 'Register now',
          link: 'https://example.com/register',
          external: true
        }
      }
    })

    expect(mdx).toContain('buttonExternal={true}')
  })

  it('rejects a missing When title', () => {
    expect(() => serialize({ when: { title: '' }, where })).toThrow(
      SerializerFieldError
    )
  })

  it('rejects Apply without a CTA link', () => {
    expect(() =>
      serialize({
        when,
        where,
        apply: {
          title: 'Apply',
          primaryCta: { text: 'Apply today', link: '' }
        }
      })
    ).toThrow(SerializerFieldError)
  })
})
