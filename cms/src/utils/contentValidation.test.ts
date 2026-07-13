import { describe, it, expect } from 'vitest'
import { errors } from '@strapi/utils'
import {
  validateNoNestedJsx,
  validateNavigationLabels,
  validateGrantPagePrimaryCta,
  validateGrantPageFaqSection,
  validateGrantInfoCards,
  validateProfileCta,
  validateCtaStrip,
  validateHeroFields,
  validateBlogFields,
  mergeValidationErrors
} from '@/utils'

describe('validateNoNestedJsx', () => {
  it('returns a ValidationError when a paragraph block contains bare JSX', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content:
          'Some text\n\n<Blockquote source="Someone">Smart quote</Blockquote>'
      }
    ]

    const err = validateNoNestedJsx(content)
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toContain('<Blockquote>')
  })

  it('returns undefined for plain markdown content', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: '## Heading\n\nSome **bold** text.'
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('ignores JSX inside fenced code blocks', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: [
          'Some text.',
          '',
          '```jsx',
          '<Blockquote source="Someone">example</Blockquote>',
          '```'
        ].join('\n')
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('ignores a standalone multi-line fenced block', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: [
          '```tsx',
          '<ProfileCard name="A" />',
          '<CalloutText>note</CalloutText>',
          '```'
        ].join('\n')
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('ignores JSX inside inline code spans (INTORG-793)', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content:
          'Use the `<WalletAddress />` component and the `<Blockquote>` tag inline.'
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('ignores JSX inside double-backtick inline code', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: 'Render ``<CalloutText prop="`x`" />`` literally.'
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('still flags bare JSX even when other JSX is in inline code', () => {
    const content = [
      {
        __component: 'blocks.paragraph',
        content: 'Inline `<Safe />` is fine but <Blockquote> is not.'
      }
    ]

    const err = validateNoNestedJsx(content)
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toContain('<Blockquote>')
  })

  it('ignores non-paragraph blocks', () => {
    const content = [
      {
        __component: 'blocks.blockquote',
        content: '<CalloutText content="nested" />'
      }
    ]

    expect(validateNoNestedJsx(content)).toBeUndefined()
  })

  it('returns undefined for non-array input', () => {
    expect(validateNoNestedJsx(undefined)).toBeUndefined()
    expect(validateNoNestedJsx('raw string')).toBeUndefined()
    expect(validateNoNestedJsx(null)).toBeUndefined()
  })
})

describe('validateNavigationLabels', () => {
  it('returns undefined when there is no mainMenu or ctaButton', () => {
    expect(validateNavigationLabels({})).toBeUndefined()
  })

  it('returns undefined for fully labeled navigation data', () => {
    const data = {
      mainMenu: [
        {
          label: 'Group',
          items: [{ label: 'Item' }],
          subGroups: [
            {
              label: 'Sub Group',
              items: [{ label: 'Sub Item' }]
            }
          ]
        }
      ],
      ctaButton: { label: 'CTA' }
    }

    expect(validateNavigationLabels(data)).toBeUndefined()
  })

  it('returns a ValidationError when a top-level menu group is missing a label', () => {
    const data = { mainMenu: [{ label: '' }] }

    const err = validateNavigationLabels(data)
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toBe('Main Menu: Item 1 is missing a required label')
    // The admin only highlights the specific field when details.errors[].path
    // matches Strapi's own Yup error shape — this is what INTORG-796 was
    // missing on the first pass (a generic toast, no field highlighting).
    expect(err?.details).toEqual({
      errors: [
        {
          path: ['mainMenu', '0', 'label'],
          message: 'Main Menu: Item 1 is missing a required label',
          name: 'ValidationError'
        }
      ]
    })
  })

  it('treats a whitespace-only label as missing', () => {
    const data = { mainMenu: [{ label: '   ' }] }

    expect(validateNavigationLabels(data)?.message).toBe(
      'Main Menu: Item 1 is missing a required label'
    )
  })

  it('returns a ValidationError when a menu item is missing a label', () => {
    const data = {
      mainMenu: [{ label: 'Group', items: [{ label: 'Valid' }, { label: '' }] }]
    }

    expect(validateNavigationLabels(data)?.message).toBe(
      '"Group": Item 2 is missing a required label'
    )
  })

  it('returns a ValidationError when a sub-group is missing a label', () => {
    const data = {
      mainMenu: [
        {
          label: 'Group',
          subGroups: [{ label: 'Valid' }, { label: '' }]
        }
      ]
    }

    expect(validateNavigationLabels(data)?.message).toBe(
      '"Group": Sub-group 2 is missing a required label'
    )
  })

  it('returns a ValidationError when an item inside a sub-group is missing a label', () => {
    const data = {
      mainMenu: [
        {
          label: 'Group',
          subGroups: [
            { label: 'Sub Group', items: [{ label: 'Valid' }, { label: '' }] }
          ]
        }
      ]
    }

    expect(validateNavigationLabels(data)?.message).toBe(
      '"Group" / "Sub Group": Item 2 is missing a required label'
    )
  })

  it('returns a ValidationError when the CTA button is missing a label', () => {
    const data = { ctaButton: { label: '' } }

    expect(validateNavigationLabels(data)?.message).toBe(
      'CTA Button: Label is required'
    )
  })
})

const validCard = {
  heading: 'Why Apply',
  body: 'Funding to support your project.'
}

describe('validateGrantInfoCards', () => {
  it('returns undefined when infoCards is absent', () => {
    expect(validateGrantInfoCards({})).toBeUndefined()
  })

  it('returns undefined when infoCards is explicitly null', () => {
    expect(validateGrantInfoCards({ infoCards: null })).toBeUndefined()
  })

  it('returns undefined for a fully valid infoCards object', () => {
    const data = {
      infoCards: {
        card1: validCard,
        card2: validCard,
        card3: validCard
      }
    }

    expect(validateGrantInfoCards(data)).toBeUndefined()
  })

  it('flags a missing card with a path pointing at infoCards.card2', () => {
    const data = {
      infoCards: {
        card1: validCard,
        card3: validCard
      }
    }

    const err = validateGrantInfoCards(data)
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toBe('Information Cards: card2 is required')
    expect(err?.details.errors[0].path).toEqual(['infoCards', 'card2'])
  })

  it('flags a missing card heading with an index-aware path', () => {
    const data = {
      infoCards: {
        card1: validCard,
        card2: { body: validCard.body },
        card3: validCard
      }
    }

    const err = validateGrantInfoCards(data)
    expect(err?.message).toBe('Information Cards: card2 heading is required')
    expect(err?.details.errors[0].path).toEqual([
      'infoCards',
      'card2',
      'heading'
    ])
  })

  it('treats a whitespace-only heading as missing', () => {
    const data = {
      infoCards: {
        card1: validCard,
        card2: { heading: '   ', body: validCard.body },
        card3: validCard
      }
    }

    expect(validateGrantInfoCards(data)?.message).toBe(
      'Information Cards: card2 heading is required'
    )
  })

  it('returns a ValidationError when a card body is missing', () => {
    const data = {
      infoCards: {
        card1: validCard,
        card2: { heading: validCard.heading },
        card3: validCard
      }
    }

    expect(validateGrantInfoCards(data)?.message).toBe(
      'Information Cards: card2 body is required'
    )
  })

  it('treats a whitespace-only body as missing', () => {
    const data = {
      infoCards: {
        card1: validCard,
        card2: { heading: validCard.heading, body: '   ' },
        card3: validCard
      }
    }

    expect(validateGrantInfoCards(data)?.message).toBe(
      'Information Cards: card2 body is required'
    )
  })

  it('reports every failing card at once, not just the first', () => {
    const data = {
      infoCards: {
        card1: { heading: '', body: '' },
        card2: validCard,
        card3: { heading: validCard.heading }
      }
    }

    const err = validateGrantInfoCards(data)
    expect(err?.details.errors.map((e) => e.path)).toEqual([
      ['infoCards', 'card1', 'heading'],
      ['infoCards', 'card1', 'body'],
      ['infoCards', 'card3', 'body']
    ])
  })
})

describe('validateGrantPagePrimaryCta', () => {
  it('returns undefined when primaryCta is absent', () => {
    expect(validateGrantPagePrimaryCta({})).toBeUndefined()
  })

  it('returns undefined when text and link are both present', () => {
    expect(
      validateGrantPagePrimaryCta({
        primaryCta: { text: 'Apply now', link: 'https://example.com' }
      })
    ).toBeUndefined()
  })

  it('flags a missing text with a path pointing at primaryCta.text', () => {
    const err = validateGrantPagePrimaryCta({
      primaryCta: { text: '', link: 'https://example.com' }
    })
    expect(err?.message).toBe('Primary Call to Action: Text is required')
    expect(err?.details).toEqual({
      errors: [
        {
          path: ['primaryCta', 'text'],
          message: 'Primary Call to Action: Text is required',
          name: 'ValidationError'
        }
      ]
    })
  })

  it('flags a missing link with a path pointing at primaryCta.link', () => {
    const err = validateGrantPagePrimaryCta({
      primaryCta: { text: 'Apply now', link: '' }
    })
    expect(err?.message).toBe('Primary Call to Action: Link is required')
    expect(err?.details.errors[0].path).toEqual(['primaryCta', 'link'])
  })

  it('reports both text and link as separate entries when both are missing, not just the first', () => {
    const err = validateGrantPagePrimaryCta({
      primaryCta: { text: '', link: '' }
    })
    expect(err?.details.errors).toEqual([
      {
        path: ['primaryCta', 'text'],
        message: 'Primary Call to Action: Text is required',
        name: 'ValidationError'
      },
      {
        path: ['primaryCta', 'link'],
        message: 'Primary Call to Action: Link is required',
        name: 'ValidationError'
      }
    ])
  })
})

describe('validateProfileCta', () => {
  it('returns undefined when cta is absent', () => {
    expect(validateProfileCta({})).toBeUndefined()
  })

  it('returns undefined when text and link are both present', () => {
    expect(
      validateProfileCta({
        cta: { text: 'Read more', link: 'https://example.com' }
      })
    ).toBeUndefined()
  })

  it('flags a missing text with a path pointing at cta.text', () => {
    const err = validateProfileCta({ cta: { text: '', link: 'https://x.com' } })
    expect(err?.message).toBe('Call to Action: Text is required')
    expect(err?.details.errors[0].path).toEqual(['cta', 'text'])
  })

  it('flags a missing link with a path pointing at cta.link', () => {
    const err = validateProfileCta({ cta: { text: 'Read more', link: '' } })
    expect(err?.message).toBe('Call to Action: Link is required')
    expect(err?.details.errors[0].path).toEqual(['cta', 'link'])
  })
})

describe('validateCtaStrip', () => {
  const validCtaStrip = {
    heading: 'Ready?',
    description: 'Join us',
    primaryButtonText: 'Start',
    primaryButtonLink: 'https://example.com'
  }

  it('flags the whole ctaStrip as required when absent — unlike primaryCta/faqSection, it is not optional', () => {
    const err = validateCtaStrip({})
    expect(err?.message).toBe('CTA Strip is required')
    expect(err?.details.errors[0].path).toEqual(['ctaStrip'])
  })

  it('returns undefined when all required fields are present', () => {
    expect(validateCtaStrip({ ctaStrip: validCtaStrip })).toBeUndefined()
  })

  it('does not require color — it defaults to purple at the MDX layer (see cta-strip-roundtrip.test.ts)', () => {
    expect(
      validateCtaStrip({ ctaStrip: { ...validCtaStrip, color: undefined } })
    ).toBeUndefined()
  })

  it('flags a missing heading with a path pointing at ctaStrip.heading', () => {
    const err = validateCtaStrip({
      ctaStrip: { ...validCtaStrip, heading: '' }
    })
    expect(err?.message).toBe('CTA Strip: Heading is required')
    expect(err?.details.errors[0].path).toEqual(['ctaStrip', 'heading'])
  })

  it('reports every missing field at once, not just the first', () => {
    const err = validateCtaStrip({
      ctaStrip: {
        heading: '',
        description: '',
        primaryButtonText: 'Start',
        primaryButtonLink: 'https://example.com'
      }
    })
    expect(err?.details.errors.map((e) => e.path)).toEqual([
      ['ctaStrip', 'heading'],
      ['ctaStrip', 'description']
    ])
  })
})

describe('validateGrantPageFaqSection', () => {
  it('returns undefined when faqSection is absent', () => {
    expect(validateGrantPageFaqSection({})).toBeUndefined()
  })

  it('flags a missing title with a path pointing at faqSection.title', () => {
    const err = validateGrantPageFaqSection({
      faqSection: {
        title: '',
        subtitle: 's',
        description: 'd',
        ctaText: 'c',
        ctaLink: 'l',
        items: [
          { question: 'q1', answer: 'a1' },
          { question: 'q2', answer: 'a2' }
        ]
      }
    })
    expect(err?.message).toBe('FAQ Section: Title is required')
    expect(err?.details.errors[0].path).toEqual(['faqSection', 'title'])
  })

  it('flags a missing item answer with an index-aware path', () => {
    const err = validateGrantPageFaqSection({
      faqSection: {
        title: 't',
        subtitle: 's',
        description: 'd',
        ctaText: 'c',
        ctaLink: 'l',
        items: [
          { question: 'q1', answer: 'a1' },
          { question: 'q2', answer: '' }
        ]
      }
    })
    expect(err?.message).toBe('FAQ Section: Item 2 is missing an answer')
    expect(err?.details.errors[0].path).toEqual([
      'faqSection',
      'items',
      '1',
      'answer'
    ])
  })

  it('reports every missing scalar field at once, not just the first', () => {
    const err = validateGrantPageFaqSection({
      faqSection: {
        title: '',
        subtitle: '',
        description: 'd',
        ctaText: 'c',
        ctaLink: 'l',
        items: [
          { question: 'q1', answer: 'a1' },
          { question: 'q2', answer: 'a2' }
        ]
      }
    })
    expect(err?.details.errors.map((e) => e.path)).toEqual([
      ['faqSection', 'title'],
      ['faqSection', 'subtitle']
    ])
  })
})

describe('validateHeroFields', () => {
  it('returns undefined when hero is absent', () => {
    expect(validateHeroFields({})).toBeUndefined()
  })

  it('returns undefined for a valid hero', () => {
    expect(
      validateHeroFields({
        hero: {
          title: 'Hello',
          hero_call_to_action: [{ text: 'Go', link: '/go' }]
        }
      })
    ).toBeUndefined()
  })

  it('flags a missing title with a path pointing at hero.title', () => {
    const err = validateHeroFields({ hero: { title: '' } })
    expect(err?.message).toBe('Hero is missing required title')
    expect(err?.details.errors[0].path).toEqual(['hero', 'title'])
  })

  it('flags a CTA missing link with an index-aware path', () => {
    const err = validateHeroFields({
      hero: {
        title: 'Hello',
        hero_call_to_action: [
          { text: 'Go', link: '/go' },
          { text: 'Also go', link: '' }
        ]
      }
    })
    expect(err?.message).toBe('Hero CTA is missing required link')
    expect(err?.details.errors[0].path).toEqual([
      'hero',
      'hero_call_to_action',
      '1',
      'link'
    ])
  })
})

describe('validateBlogFields', () => {
  it('returns undefined when both fields are absent', () => {
    expect(validateBlogFields({})).toBeUndefined()
  })

  it('flags a bio missing an author with an index-aware path', () => {
    const err = validateBlogFields({
      articleBio: [{ author: 'Jane' }, { author: null }]
    })
    expect(err?.message).toBe('Author Bio: Name is required')
    expect(err?.details.errors[0].path).toEqual(['articleBio', '1', 'author'])
  })

  it('flags a related article missing a slug with an index-aware path', () => {
    const err = validateBlogFields({
      relatedArticles: [{ slug: 'valid' }, { slug: '' }]
    })
    expect(err?.message).toBe('Related Articles: Slug is required')
    expect(err?.details.errors[0].path).toEqual([
      'relatedArticles',
      '1',
      'slug'
    ])
  })

  it('reports a missing bio author and a missing related-article slug together', () => {
    const err = validateBlogFields({
      articleBio: [{ author: null }],
      relatedArticles: [{ slug: '' }]
    })
    expect(err?.details.errors.map((e) => e.path)).toEqual([
      ['articleBio', '0', 'author'],
      ['relatedArticles', '0', 'slug']
    ])
  })
})

describe('mergeValidationErrors', () => {
  it('returns undefined when no validators found anything', () => {
    expect(mergeValidationErrors(undefined, undefined)).toBeUndefined()
  })

  it('passes a single validator error through unchanged', () => {
    const err = new errors.ValidationError('bad field', {
      errors: [{ path: ['a'], message: 'bad field', name: 'ValidationError' }]
    })
    const merged = mergeValidationErrors(err, undefined)
    expect(merged?.message).toBe('bad field')
    expect(merged?.details).toEqual(err.details)
  })

  it('combines details.errors from multiple validators into one response, using the first message as the top-level message', () => {
    const primaryCtaErr = validateGrantPagePrimaryCta({
      primaryCta: { text: '', link: 'https://x.com' }
    })
    const faqErr = validateGrantPageFaqSection({
      faqSection: {
        title: '',
        subtitle: 's',
        description: 'd',
        ctaText: 'c',
        ctaLink: 'l',
        items: [
          { question: 'q1', answer: 'a1' },
          { question: 'q2', answer: 'a2' }
        ]
      }
    })

    const merged = mergeValidationErrors(primaryCtaErr, faqErr)

    expect(merged?.message).toBe('Primary Call to Action: Text is required')
    expect(merged?.details.errors.map((e) => e.path)).toEqual([
      ['primaryCta', 'text'],
      ['faqSection', 'title']
    ])
  })
})
