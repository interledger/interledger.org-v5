/**
 * Tests for JSX attribute extraction helpers.
 *
 * Every test starts from an MDX string, parses it through remark + remark-mdx,
 * then validates the extracted value.  This ensures we test the full path from
 * real MDX syntax → AST → extracted value.
 */

import { describe, it, expect } from 'vitest'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import {
  getStringAttr,
  getNumberAttr,
  getBooleanAttr,
  getStringArrayAttr,
  getChildrenText
} from './jsxExtract'

/** Parse MDX and return the first JSX flow element. */
function parseJsx(mdx: string): MdxJsxFlowElement {
  const tree = remark().use(remarkMdx).parse(mdx)
  const node = tree.children.find((n) => n.type === 'mdxJsxFlowElement')
  if (!node) throw new Error('No JSX flow element found in: ' + mdx)
  return node as MdxJsxFlowElement
}

// --------------------------------------------------------------------------
// getStringAttr
// --------------------------------------------------------------------------

describe('getStringAttr', () => {
  it('extracts a double-quoted string literal', () => {
    const node = parseJsx('<Foo bar="hello world" />')
    expect(getStringAttr(node, 'bar')).toBe('hello world')
  })

  it('extracts a string wrapped in expression braces', () => {
    const node = parseJsx('<Foo bar={"hello"} />')
    expect(getStringAttr(node, 'bar')).toBe('hello')
  })

  it('returns undefined when attribute is absent', () => {
    const node = parseJsx('<Foo />')
    expect(getStringAttr(node, 'bar')).toBeUndefined()
  })

  it('throws on a variable expression', () => {
    const node = parseJsx('<Foo bar={myVar} />')
    expect(() => getStringAttr(node, 'bar')).toThrow(/only static string/)
  })

  it('extracts empty string attribute', () => {
    const node = parseJsx('<Foo bar="" />')
    expect(getStringAttr(node, 'bar')).toBe('')
  })

  it('extracts string with special characters', () => {
    const node = parseJsx('<Foo bar="**Jane**, Acme Corp" />')
    expect(getStringAttr(node, 'bar')).toBe('**Jane**, Acme Corp')
  })
})

// --------------------------------------------------------------------------
// getNumberAttr
// --------------------------------------------------------------------------

describe('getNumberAttr', () => {
  it('extracts a numeric expression', () => {
    const node = parseJsx('<Foo columns={3} />')
    expect(getNumberAttr(node, 'columns')).toBe(3)
  })

  it('extracts a number from a plain string attribute', () => {
    const node = parseJsx('<Foo columns="4" />')
    expect(getNumberAttr(node, 'columns')).toBe(4)
  })

  it('returns undefined when attribute is absent', () => {
    const node = parseJsx('<Foo />')
    expect(getNumberAttr(node, 'columns')).toBeUndefined()
  })

  it('throws on a non-numeric expression', () => {
    const node = parseJsx('<Foo columns={someVar} />')
    expect(() => getNumberAttr(node, 'columns')).toThrow(/only static numeric/)
  })

  it('handles zero', () => {
    const node = parseJsx('<Foo columns={0} />')
    expect(getNumberAttr(node, 'columns')).toBe(0)
  })
})

// --------------------------------------------------------------------------
// getBooleanAttr
// --------------------------------------------------------------------------

describe('getBooleanAttr', () => {
  it('returns true for boolean shorthand', () => {
    const node = parseJsx('<Foo showLinks />')
    expect(getBooleanAttr(node, 'showLinks')).toBe(true)
  })

  it('returns true for expression {true}', () => {
    const node = parseJsx('<Foo showLinks={true} />')
    expect(getBooleanAttr(node, 'showLinks')).toBe(true)
  })

  it('returns false for expression {false}', () => {
    const node = parseJsx('<Foo showLinks={false} />')
    expect(getBooleanAttr(node, 'showLinks')).toBe(false)
  })

  it('returns undefined when attribute is absent', () => {
    const node = parseJsx('<Foo />')
    expect(getBooleanAttr(node, 'showLinks')).toBeUndefined()
  })

  it('throws on a non-boolean expression', () => {
    const node = parseJsx('<Foo showLinks={someVar} />')
    expect(() => getBooleanAttr(node, 'showLinks')).toThrow(
      /only static boolean/
    )
  })
})

// --------------------------------------------------------------------------
// getStringArrayAttr
// --------------------------------------------------------------------------

describe('getStringArrayAttr', () => {
  it('extracts an array of double-quoted strings', () => {
    const node = parseJsx('<Foo slugs={["alice","bob"]} />')
    expect(getStringArrayAttr(node, 'slugs')).toEqual(['alice', 'bob'])
  })

  it('extracts a single-element array', () => {
    const node = parseJsx('<Foo slugs={["only-one"]} />')
    expect(getStringArrayAttr(node, 'slugs')).toEqual(['only-one'])
  })

  it('extracts an empty array', () => {
    const node = parseJsx('<Foo slugs={[]} />')
    expect(getStringArrayAttr(node, 'slugs')).toEqual([])
  })

  it('returns undefined when attribute is absent', () => {
    const node = parseJsx('<Foo />')
    expect(getStringArrayAttr(node, 'slugs')).toBeUndefined()
  })

  it('throws on a non-array expression', () => {
    const node = parseJsx('<Foo slugs={myVar} />')
    expect(() => getStringArrayAttr(node, 'slugs')).toThrow(
      /expected an array literal/
    )
  })

  it('throws when array contains non-string elements', () => {
    const node = parseJsx('<Foo slugs={[1, 2]} />')
    expect(() => getStringArrayAttr(node, 'slugs')).toThrow(/non-string/)
  })
})

// --------------------------------------------------------------------------
// getChildrenText
// --------------------------------------------------------------------------

describe('getChildrenText', () => {
  it('extracts plain text children', () => {
    const node = parseJsx('<Blockquote>\nGreat work.\n</Blockquote>')
    expect(getChildrenText(node)).toBe('Great work.')
  })

  it('extracts markdown-formatted children', () => {
    const node = parseJsx('<Blockquote>\nSome **bold** text\n</Blockquote>')
    expect(getChildrenText(node)).toContain('**bold**')
  })

  it('returns empty string for self-closing elements', () => {
    const node = parseJsx('<Ambassador slug="test" />')
    expect(getChildrenText(node)).toBe('')
  })

  it('extracts multiline children', () => {
    const node = parseJsx('<Blockquote>\nLine one.\n\nLine two.\n</Blockquote>')
    const text = getChildrenText(node)
    expect(text).toContain('Line one.')
    expect(text).toContain('Line two.')
  })

  it('preserves inline formatting across children', () => {
    const node = parseJsx(
      '<CalloutText>\nThis is *important* content\n</CalloutText>'
    )
    expect(getChildrenText(node)).toContain('*important*')
  })
})
