import { describe, it, expect } from 'vitest'
import { validateNoNestedJsx, validateNavigationLabels } from '@/utils'

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
          '<Ambassador name="A" />',
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
