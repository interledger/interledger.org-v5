import { describe, expect, it } from 'vitest'
import config from '../astro.config.mjs'

const GFM_SAMPLE = `| Name | Value |
| ---- | ----- |
| a    | 1     |

Text with a note.[^1]

[^1]: The note.
`

describe('markdown.processor', () => {
  it('renders GFM tables and footnotes in MDX', async () => {
    const processor = config.markdown?.processor
    // The rehype plugins in astro.config.mjs run only on this processor.
    expect(processor?.name).toBe('unified')
    const renderer = await processor?.createMdxRenderer?.(
      {},
      { optimize: false }
    )
    const result = await renderer?.process(GFM_SAMPLE, '/sample.mdx', {})
    expect(result?.code).toContain('"table"')
    expect(result?.code).toContain('user-content-fn-1')
  })
})
