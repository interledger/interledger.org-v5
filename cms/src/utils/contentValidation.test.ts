import { describe, it, expect } from 'vitest'
import {
  validateNoNestedJsx,
  validateNavigationLabels,
  validateGrantInfoCards
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

  it('returns a ValidationError when card2 is missing entirely', () => {
    const data = {
      infoCards: {
        card1: validCard,
        card3: validCard
      }
    }

    const err = validateGrantInfoCards(data)
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toBe('Information Cards: card2 is required')
  })

  it('returns a ValidationError when a card heading is missing', () => {
    const data = {
      infoCards: {
        card1: validCard,
        card2: { body: validCard.body },
        card3: validCard
      }
    }

    expect(validateGrantInfoCards(data)?.message).toBe(
      'Information Cards: card2 heading is required'
    )
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

  it('checks cards in order, reporting the first failing card', () => {
    const data = {
      infoCards: {
        card1: { heading: '', body: '' },
        card2: validCard,
        card3: validCard
      }
    }

    expect(validateGrantInfoCards(data)?.message).toBe(
      'Information Cards: card1 heading is required'
    )
  })
})
