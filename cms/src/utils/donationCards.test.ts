import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function contentComponents(contentType: string): string[] {
  const schemaPath = fileURLToPath(
    new URL(
      `../api/${contentType}/content-types/${contentType}/schema.json`,
      import.meta.url
    )
  )
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  return schema.attributes.content.components
}

describe('Donation Cards availability', () => {
  it('is only on a Fundraising Page', () => {
    expect(contentComponents('fundraising-page')).toContain(
      'blocks.donation-cards'
    )
    expect(contentComponents('foundation-page')).not.toContain(
      'blocks.donation-cards'
    )
  })
})
