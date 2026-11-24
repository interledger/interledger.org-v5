import { describe, expect, it } from 'vitest'
import {
  collectRfcImageSources,
  resolveRfcImageSource,
  rewriteRfcImages
} from './rfcImages'

const RFC_URL =
  'https://raw.githubusercontent.com/interledger/rfcs/master/0001-interledger-architecture/0001-interledger-architecture.md'

describe('resolveRfcImageSource', () => {
  it('reads the source path from an absolute interledger/rfcs raw URL', () => {
    const src =
      'https://raw.githubusercontent.com/interledger/rfcs/master/shared/graphs/protocol-suite.svg'

    expect(resolveRfcImageSource(src, RFC_URL)).toEqual({
      sourcePath: 'shared/graphs/protocol-suite.svg',
      downloadUrl: src
    })
  })

  it('resolves a relative path against the RFC, on its branch', () => {
    expect(resolveRfcImageSource('../shared/graphs/x.svg', RFC_URL)).toEqual({
      sourcePath: 'shared/graphs/x.svg',
      downloadUrl:
        'https://raw.githubusercontent.com/interledger/rfcs/master/shared/graphs/x.svg'
    })
  })

  it.each([
    'https://example.com/diagram.svg',
    'https://raw.githubusercontent.com/interledger/other-repo/master/x.svg',
    '//cdn.example.com/x.png',
    '/img/x.png',
    'data:image/png;base64,AAAA',
    ''
  ])('leaves %s alone', (src) => {
    expect(resolveRfcImageSource(src, RFC_URL)).toBeNull()
  })
})

describe('collectRfcImageSources', () => {
  it('lists each interledger/rfcs image once and skips other hosts', () => {
    const html = `
      <img src="../shared/graphs/a.svg">
      <img src="https://raw.githubusercontent.com/interledger/rfcs/master/shared/graphs/a.svg">
      <img src="https://example.com/b.png">`

    expect(
      collectRfcImageSources(html, RFC_URL).map(({ sourcePath }) => sourcePath)
    ).toEqual(['shared/graphs/a.svg'])
  })

  it('returns nothing for an RFC without images', () => {
    expect(collectRfcImageSources('<p>No images.</p>', RFC_URL)).toEqual([])
  })
})

describe('rewriteRfcImages', () => {
  const localImageUrl = (sourcePath: string) =>
    sourcePath === 'shared/graphs/a.svg' ? '/_astro/a.123.svg' : undefined

  it('points interledger/rfcs images at the local copy and keeps the alt', () => {
    const html = rewriteRfcImages(
      '<img src="../shared/graphs/a.svg" alt="Diagram A">',
      RFC_URL,
      localImageUrl
    )

    expect(html).toBe('<img src="/_astro/a.123.svg" alt="Diagram A">')
  })

  it('leaves images on other hosts untouched', () => {
    const input = '<img src="https://example.com/b.png" alt="B">'

    expect(rewriteRfcImages(input, RFC_URL, localImageUrl)).toBe(input)
  })

  it('returns an error listing every image without a local copy', () => {
    const result = rewriteRfcImages(
      '<img src="../shared/graphs/x.svg"><img src="../shared/graphs/y.svg">',
      RFC_URL,
      localImageUrl
    )

    expect(result).toBeInstanceOf(Error)
    expect(String(result)).toContain('shared/graphs/x.svg, shared/graphs/y.svg')
  })
})
