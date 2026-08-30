import { describe, expect, it } from 'vitest'
import { formatDocumentTitle } from './documentTitle'

describe('formatDocumentTitle', () => {
  it('returns only the site name when the page title is absent, blank, or identical', () => {
    expect(formatDocumentTitle('Interledger Foundation')).toBe(
      'Interledger Foundation'
    )
    expect(formatDocumentTitle('Interledger Foundation', '')).toBe(
      'Interledger Foundation'
    )
    expect(formatDocumentTitle('Interledger Foundation', '   ')).toBe(
      'Interledger Foundation'
    )
    expect(
      formatDocumentTitle('Interledger Foundation', 'Interledger Foundation')
    ).toBe('Interledger Foundation')
  })

  it('appends the page title with a pipe separator', () => {
    expect(
      formatDocumentTitle('Interledger Foundation', 'Our Grantmaking')
    ).toBe('Interledger Foundation | Our Grantmaking')
    expect(formatDocumentTitle('Open Payment Hackathons', 'Overview')).toBe(
      'Open Payment Hackathons | Overview'
    )
  })
})
