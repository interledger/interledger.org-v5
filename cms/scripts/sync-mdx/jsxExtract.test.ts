import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import type { Root } from 'mdast'

import { getStringAttr, getBooleanAttr, getStringArrayAttr } from './jsxExtract'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// ---------------------------------------------------------------------------
// Helper: parse MDX snippet and extract the first JSX flow element
// ---------------------------------------------------------------------------

function parseJsx(mdx: string): MdxJsxFlowElement {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(mdx) as Root
  const node = tree.children.find((n) => n.type === 'mdxJsxFlowElement')
  if (!node) throw new Error('No JSX flow element found in snippet')
  return node as MdxJsxFlowElement
}

// ---------------------------------------------------------------------------
// getStringAttr
// ---------------------------------------------------------------------------

describe('getStringAttr', () => {
  it('extracts a string literal attribute', () => {
    const node = parseJsx('<Foo bar="hello" />')
    expect(getStringAttr(node, 'bar')).toBe('hello')
  })

  it('returns undefined for missing optional attribute', () => {
    const node = parseJsx('<Foo />')
    expect(getStringAttr(node, 'bar')).toBeUndefined()
  })

  it('throws MISSING_REQUIRED_PROP for missing required attribute', () => {
    const node = parseJsx('<Foo />')
    expect(() => getStringAttr(node, 'bar', { required: true })).toThrow(
      MdxParserError
    )
    expect(() => getStringAttr(node, 'bar', { required: true })).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.MISSING_REQUIRED_PROP,
        prop: 'bar'
      })
    )
  })

  it('returns expression source as text', () => {
    const node = parseJsx('<Foo bar={someVar} />')
    expect(getStringAttr(node, 'bar')).toBe('someVar')
  })
})

// ---------------------------------------------------------------------------
// getBooleanAttr
// ---------------------------------------------------------------------------

describe('getBooleanAttr', () => {
  it('returns true for valueless attribute (<Foo bar />)', () => {
    const node = parseJsx('<Foo bar />')
    expect(getBooleanAttr(node, 'bar')).toBe(true)
  })

  it('returns true for expression {true}', () => {
    const node = parseJsx('<Foo bar={true} />')
    expect(getBooleanAttr(node, 'bar')).toBe(true)
  })

  it('returns false for expression {false}', () => {
    const node = parseJsx('<Foo bar={false} />')
    expect(getBooleanAttr(node, 'bar')).toBe(false)
  })

  it('returns undefined for missing attribute', () => {
    const node = parseJsx('<Foo />')
    expect(getBooleanAttr(node, 'bar')).toBeUndefined()
  })

  it('returns undefined for non-boolean expression text', () => {
    const node = parseJsx('<Foo bar={someVar} />')
    expect(getBooleanAttr(node, 'bar')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getStringArrayAttr
// ---------------------------------------------------------------------------

describe('getStringArrayAttr', () => {
  it('extracts a static string array with double quotes', () => {
    const node = parseJsx('<Foo items={["a","b","c"]} />')
    expect(getStringArrayAttr(node, 'items')).toEqual(['a', 'b', 'c'])
  })

  it('returns undefined for missing optional attribute', () => {
    const node = parseJsx('<Foo />')
    expect(getStringArrayAttr(node, 'items')).toBeUndefined()
  })

  it('throws MISSING_REQUIRED_PROP for missing required attribute', () => {
    const node = parseJsx('<Foo />')
    expect(() => getStringArrayAttr(node, 'items', { required: true })).toThrow(
      MdxParserError
    )
    expect(() => getStringArrayAttr(node, 'items', { required: true })).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.MISSING_REQUIRED_PROP
      })
    )
  })

  it('throws INVALID_PROP_VALUE for plain string attribute', () => {
    const node = parseJsx('<Foo items="not-an-array" />')
    expect(() => getStringArrayAttr(node, 'items')).toThrow(MdxParserError)
    expect(() => getStringArrayAttr(node, 'items')).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.INVALID_PROP_VALUE
      })
    )
  })

  it('throws INVALID_PROP_VALUE for non-JSON expression', () => {
    const node = parseJsx('<Foo items={someVar} />')
    expect(() => getStringArrayAttr(node, 'items')).toThrow(MdxParserError)
    expect(() => getStringArrayAttr(node, 'items')).toThrow(
      expect.objectContaining({
        code: ParserErrorCode.INVALID_PROP_VALUE
      })
    )
  })
})
