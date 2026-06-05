import type { Root } from 'hast'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { VFile } from 'vfile'
import { describe, expect, it } from 'vitest'
import rehypeWrapScrollableTables from './rehypeWrapScrollableTables'

const FILE_PATH =
  '/repo/src/content/foundation-blog-posts/2025-06-11-2025-digital-financial-services-grant.mdx'

function processor() {
  return unified()
    .use(rehypeWrapScrollableTables)
    .use(rehypeStringify)
}

async function run(tree: Root, path = FILE_PATH): Promise<string> {
  const file = new VFile({ path, value: '' })
  const transformed = await processor().run(tree, file)
  return String(await processor().stringify(transformed, file))
}

describe('rehypeWrapScrollableTables', () => {
  it('wraps a table whose parent is a regular element', async () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'div',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'table',
              properties: {},
              children: []
            }
          ]
        }
      ]
    }

    const out = await run(tree)
    expect(out).toContain('class="table-scroll"')
    expect(out).toContain('role="region"')
    expect(out).toContain('tabindex="0"')
    expect(out).toContain('data-lenis-prevent')
    expect(out).toContain('<table>')
  })

  it('wraps a table inside an MDX Paragraph component', async () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'mdxJsxFlowElement',
          name: 'Paragraph',
          attributes: [],
          children: [
            {
              type: 'element',
              tagName: 'table',
              properties: {},
              children: []
            }
          ]
        }
      ]
    }

    const file = new VFile({ path: FILE_PATH, value: '' })
    const transformed = (await unified()
      .use(rehypeWrapScrollableTables)
      .run(tree, file)) as Root

    const paragraph = transformed.children[0]
    expect(paragraph.type).toBe('mdxJsxFlowElement')
    expect(paragraph.children[0]).toMatchObject({
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['table-scroll'],
        role: 'region',
        tabIndex: 0
      }
    })
    expect(paragraph.children[0].children[0]).toMatchObject({
      type: 'element',
      tagName: 'table'
    })
  })

  it('skips Starlight docs content', async () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'table',
          properties: {},
          children: []
        }
      ]
    }

    const out = await run(tree, '/repo/src/content/docs/about.mdx')
    expect(out).not.toContain('table-scroll')
  })
})
