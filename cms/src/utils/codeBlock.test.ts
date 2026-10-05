import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { CODE_BLOCK_LANGUAGES } from './codeBlock'

describe('CodeBlock language list', () => {
  it('stays in sync with the Strapi code-block component enum', () => {
    const schemaPath = fileURLToPath(
      new URL('../components/blocks/code-block.json', import.meta.url)
    )
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
    const enumLanguages: string[] = schema.attributes.language.enum

    expect([...enumLanguages].sort()).toEqual([...CODE_BLOCK_LANGUAGES].sort())
  })
})

describe('CodeBlock availability', () => {
  it.each([
    'foundation-blog-post',
    'foundation-page',
    'summit-page',
    'hackathon-page'
  ])('is allowed in the %s content zone', (contentType) => {
    const schemaPath = fileURLToPath(
      new URL(
        `../api/${contentType}/content-types/${contentType}/schema.json`,
        import.meta.url
      )
    )
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
    const components: string[] = schema.attributes.content.components

    expect(components).toContain('blocks.code-block')
  })
})
