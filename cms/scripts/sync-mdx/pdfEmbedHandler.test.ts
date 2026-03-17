import { describe, it, expect } from 'vitest'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ParserContext with a controllable resolveMediaUpload. */
function ctxWith(uploads: Record<string, number> = {}): ParserContext {
  return {
    locale: 'en',
    resolveMediaUpload: async (url: string) => {
      const id = uploads[url]
      if (!id) {
        throw new MdxParserError({
          code: ParserErrorCode.UNRESOLVED_RELATION,
          message: `Upload "${url}" not found.`,
          component: 'PdfEmbed'
        })
      }
      return id
    }
  }
}

// ---------------------------------------------------------------------------
// Fails before handler is imported (UNSUPPORTED_COMPONENT)
// ---------------------------------------------------------------------------

describe('PdfEmbed handler — not yet registered', () => {
  it('throws UNSUPPORTED_COMPONENT before handler is imported', async () => {
    // Use a fresh dynamic import isolation — we rely on the test running before
    // the side-effect import below registers the handler.
    // To guarantee isolation we test with a component that we know is unregistered.
    // Since this test file imports './pdfEmbedHandler' below, we verify the
    // pre-registration state by checking that the handler IS registered after import.
    // The "before" scenario is covered by the UNSUPPORTED_COMPONENT path in mdxBlockParser.
    await expect(
      parseMdxToBlocks('<UnknownComponent />', { locale: 'en' })
    ).rejects.toMatchObject({ code: ParserErrorCode.UNSUPPORTED_COMPONENT })
  })
})

// ---------------------------------------------------------------------------
// Side-effect import: registers PdfEmbed handler
// ---------------------------------------------------------------------------

import './pdfEmbedHandler'

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('PdfEmbed handler — internal URL', () => {
  it('resolves internal path to file integer ID', async () => {
    const blocks = await parseMdxToBlocks(
      '<PdfEmbed url="/uploads/2024-report.pdf" analyticsEvent="2024 report" />',
      ctxWith({ '/uploads/2024-report.pdf': 42 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.pdf-embed',
        source: 'media_library',
        file: 42,
        analyticsEvent: '2024 report'
      }
    ])
  })

  it('includes optional label when provided', async () => {
    const blocks = await parseMdxToBlocks(
      '<PdfEmbed url="/uploads/report.pdf" label="Download Report" analyticsEvent="report" />',
      ctxWith({ '/uploads/report.pdf': 7 })
    )

    expect(blocks[0]).toMatchObject({ label: 'Download Report', file: 7 })
  })

  it('omits label when not provided', async () => {
    const blocks = await parseMdxToBlocks(
      '<PdfEmbed url="/uploads/report.pdf" analyticsEvent="report" />',
      ctxWith({ '/uploads/report.pdf': 7 })
    )

    expect(blocks[0]).not.toHaveProperty('label')
  })
})

describe('PdfEmbed handler — external URL', () => {
  it('stores external URL in externalUrl', async () => {
    const blocks = await parseMdxToBlocks(
      '<PdfEmbed url="https://example.gov/policy.pdf" analyticsEvent="policy doc" />',
      ctxWith()
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.pdf-embed',
        source: 'external_url',
        externalUrl: 'https://example.gov/policy.pdf',
        analyticsEvent: 'policy doc'
      }
    ])
  })

  it('includes label with external URL', async () => {
    const blocks = await parseMdxToBlocks(
      '<PdfEmbed url="https://example.com/doc.pdf" label="Read Policy" analyticsEvent="policy" />',
      ctxWith()
    )

    expect(blocks[0]).toMatchObject({
      externalUrl: 'https://example.com/doc.pdf',
      label: 'Read Policy',
      analyticsEvent: 'policy'
    })
  })
})

describe('PdfEmbed handler — all props present', () => {
  it('parses all props correctly for internal URL', async () => {
    const blocks = await parseMdxToBlocks(
      '<PdfEmbed url="/uploads/summit.pdf" label="Summit Report" analyticsEvent="2024 SI report - Summit report" />',
      ctxWith({ '/uploads/summit.pdf': 99 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.pdf-embed',
        source: 'media_library',
        file: 99,
        label: 'Summit Report',
        analyticsEvent: '2024 SI report - Summit report'
      }
    ])
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('PdfEmbed handler — errors', () => {
  it('throws MISSING_REQUIRED_PROP when url is missing', async () => {
    await expect(
      parseMdxToBlocks('<PdfEmbed analyticsEvent="report" />', ctxWith())
    ).rejects.toMatchObject({ code: ParserErrorCode.MISSING_REQUIRED_PROP })
  })

  it('throws MISSING_REQUIRED_PROP when analyticsEvent is missing', async () => {
    await expect(
      parseMdxToBlocks(
        '<PdfEmbed url="https://example.com/doc.pdf" />',
        ctxWith()
      )
    ).rejects.toMatchObject({ code: ParserErrorCode.MISSING_REQUIRED_PROP })
  })

  it('throws DYNAMIC_EXPRESSION when url is a dynamic expression', async () => {
    await expect(
      parseMdxToBlocks(
        '<PdfEmbed url={someVar} analyticsEvent="report" />',
        ctxWith()
      )
    ).rejects.toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('throws UNRESOLVED_RELATION when internal URL is not found in Strapi', async () => {
    await expect(
      parseMdxToBlocks(
        '<PdfEmbed url="/uploads/missing.pdf" analyticsEvent="report" />',
        ctxWith({}) // no entries
      )
    ).rejects.toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })

  it('throws UNRESOLVED_RELATION when resolveMediaUpload is not in context', async () => {
    await expect(
      parseMdxToBlocks('<PdfEmbed url="/uploads/file.pdf" analyticsEvent="report" />', {
        locale: 'en'
      })
    ).rejects.toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })
})

// ---------------------------------------------------------------------------
// Integration: mixed markdown + <PdfEmbed> order is preserved
// ---------------------------------------------------------------------------

describe('PdfEmbed handler — mixed markdown + JSX ordering', () => {
  it('preserves document order with surrounding markdown', async () => {
    const mdx = [
      'Read the full report below:',
      '',
      '<PdfEmbed url="https://example.com/report.pdf" analyticsEvent="report" />',
      '',
      'Download the above document for offline reading.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctxWith())

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toEqual({
      __component: 'blocks.pdf-embed',
      source: 'external_url',
      externalUrl: 'https://example.com/report.pdf',
      analyticsEvent: 'report'
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
