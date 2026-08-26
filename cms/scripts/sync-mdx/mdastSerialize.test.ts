import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import type { Root, RootContent } from 'mdast'

import { childrenToMarkdown, extractChildrenContent } from './mdastSerialize'

function parseJsxChildren(mdx: string): RootContent[] {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(mdx) as Root
  const node = tree.children.find((n) => n.type === 'mdxJsxFlowElement')
  if (!node) throw new Error('No JSX flow element found in snippet')
  return (node as MdxJsxFlowElement).children as RootContent[]
}

const BR_PROSE =
  '<Paragraph>\nWe take on a real<br />financial challenge together.\n</Paragraph>'
const BR_TABLE = [
  '<Paragraph>',
  '| a<br/>b | c |',
  '| --- | --- |',
  '| d | e |',
  '</Paragraph>'
].join('\n')

describe('childrenToMarkdown', () => {
  it('preserves a bare <br/> outside a table untouched', () => {
    // mdxJsxToMarkdown() re-serializes the self-closing tag with a space (<br />)
    expect(childrenToMarkdown(parseJsxChildren(BR_PROSE))).toBe(
      'We take on a real<br />financial challenge together.'
    )
  })

  it('preserves a <br/> inside a table cell untouched', () => {
    expect(childrenToMarkdown(parseJsxChildren(BR_TABLE))).toBe(
      '| a<br />b | c |\n| --- | --- |\n| d | e |'
    )
  })
})

describe('extractChildrenContent', () => {
  it('preserves a bare <br/> outside a table on the raw-slice path', () => {
    expect(
      extractChildrenContent(parseJsxChildren(BR_PROSE), {
        sourceText: BR_PROSE,
        sourceTextWasProvided: true
      })
    ).toBe('We take on a real<br />financial challenge together.')
  })

  it('preserves a <br/> inside a table cell on the raw-slice path', () => {
    expect(
      extractChildrenContent(parseJsxChildren(BR_TABLE), {
        sourceText: BR_TABLE,
        sourceTextWasProvided: true
      })
    ).toBe('| a<br/>b | c |\n| --- | --- |\n| d | e |')
  })
})
