// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  dataImageToFile,
  fileStemFromAlt,
  isDataImageSrc
} from './pastedImages'

// A 1x1 PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG_DATA_URI = `data:image/png;base64,${PNG_BASE64}`

describe('isDataImageSrc', () => {
  it('accepts a base64 data: image URI', () => {
    expect(isDataImageSrc(PNG_DATA_URI)).toBe(true)
    expect(isDataImageSrc('data:image/svg+xml;base64,PHN2Zy8+')).toBe(true)
  })

  it('accepts MIME parameters before ;base64', () => {
    expect(
      isDataImageSrc('data:image/svg+xml;charset=utf-8;base64,PHN2Zy8+')
    ).toBe(true)
    expect(
      isDataImageSrc(`data:image/png;name=a.png;base64,${PNG_BASE64}`)
    ).toBe(true)
  })

  it('accepts a percent-encoded SVG, with or without a charset', () => {
    expect(isDataImageSrc('data:image/svg+xml,%3Csvg%2F%3E')).toBe(true)
    expect(
      isDataImageSrc('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')
    ).toBe(true)
  })

  it('rejects uploads, remote URLs, non-image data and non-strings', () => {
    expect(isDataImageSrc('/uploads/img/original/a.png')).toBe(false)
    expect(isDataImageSrc('https://example.com/a.png')).toBe(false)
    expect(isDataImageSrc('data:text/plain;base64,aGk=')).toBe(false)
    expect(isDataImageSrc('data:image/png,not-base64')).toBe(false)
    expect(isDataImageSrc(undefined)).toBe(false)
  })
})

describe('fileStemFromAlt', () => {
  it('turns alt text into a short slug', () => {
    expect(fileStemFromAlt('Informal vs. shadow economy (Venn)')).toBe(
      'informal-vs-shadow-economy-venn'
    )
  })

  it('folds accents', () => {
    expect(fileStemFromAlt('Economía informal')).toBe('economia-informal')
  })

  it('caps the length and trims a cut hyphen', () => {
    const stem = fileStemFromAlt(`${'a'.repeat(59)} b`)
    expect(stem).toBe('a'.repeat(59))
  })

  it('falls back when there is no usable alt', () => {
    expect(fileStemFromAlt(undefined)).toBe('pasted-image')
    expect(fileStemFromAlt('')).toBe('pasted-image')
    expect(fileStemFromAlt('!!!')).toBe('pasted-image')
  })
})

describe('dataImageToFile', () => {
  it('decodes the bytes and names the file from the alt', async () => {
    const file = dataImageToFile(PNG_DATA_URI, 'Regional chart')
    if (file instanceof Error) throw file

    expect(file.name).toBe('regional-chart.png')
    expect(file.type).toBe('image/png')
    const bytes = new Uint8Array(await file.arrayBuffer())
    expect(
      Array.from(bytes.slice(1, 4), (b) => String.fromCharCode(b))
    ).toEqual(['P', 'N', 'G'])
  })

  it('maps jpeg and svg+xml to their usual extensions', () => {
    const jpeg = dataImageToFile(`data:image/jpeg;base64,${PNG_BASE64}`)
    const svg = dataImageToFile('data:image/svg+xml;base64,PHN2Zy8+')
    if (jpeg instanceof Error || svg instanceof Error) throw new Error()

    expect(jpeg.name).toBe('pasted-image.jpg')
    expect(svg.name).toBe('pasted-image.svg')
  })

  it('decodes an SVG with a charset parameter, base64 or percent-encoded', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
    const fromBase64 = dataImageToFile(
      `data:image/svg+xml;charset=utf-8;base64,${btoa(svg)}`,
      'Logo'
    )
    const fromPercent = dataImageToFile(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    )
    if (fromBase64 instanceof Error || fromPercent instanceof Error)
      throw new Error()

    expect(fromBase64.name).toBe('logo.svg')
    expect(fromBase64.type).toBe('image/svg+xml')
    expect(await fromBase64.text()).toBe(svg)
    expect(await fromPercent.text()).toBe(svg)
  })

  it('accepts base64 wrapped over several lines', () => {
    const wrapped = `data:image/png;base64,${PNG_BASE64.slice(0, 20)}\n${PNG_BASE64.slice(20)}`
    expect(dataImageToFile(wrapped)).toBeInstanceOf(File)
  })

  it('returns an Error for a URI it cannot decode', () => {
    expect(dataImageToFile('/uploads/a.png')).toBeInstanceOf(Error)
    expect(dataImageToFile('data:image/png;base64,a')).toBeInstanceOf(Error)
    expect(dataImageToFile('data:image/svg+xml,%E0%A4%A')).toBeInstanceOf(Error)
  })
})
