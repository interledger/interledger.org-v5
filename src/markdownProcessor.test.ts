import { describe, expect, it } from 'vitest'
import config from '../astro.config.mjs'
import { TABLE_SCROLL_CLASS } from './utils/main/wrapScrollableTables'

const GFM_SAMPLE = `| Name | Value |
| ---- | ----- |
| a    | 1     |

Text with a note.[^1] and [a link](/about-us/).

[^1]: The note.
`

describe('markdown.processor', () => {
  // The rehype plugins skip files outside src/content/<collection>/, so the
  // sample needs a content path for this test to reach them.
  it('renders GFM and runs the rehype plugins in MDX', async () => {
    const processor = config.markdown?.processor
    // The rehype plugins in astro.config.mjs run only on this processor.
    expect(processor?.name).toBe('unified')
    const renderer = await processor?.createMdxRenderer?.(
      {},
      { optimize: false }
    )
    const result = await renderer?.process(
      GFM_SAMPLE,
      '/repo/src/content/foundation-pages/sample.mdx',
      {}
    )
    expect(result?.code).toContain('"table"')
    expect(result?.code).toContain('user-content-fn-1')
    expect(result?.code).toContain(TABLE_SCROLL_CLASS)
    expect(result?.code).toContain('data-umami-event')
  })
})
