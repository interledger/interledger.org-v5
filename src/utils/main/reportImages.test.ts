import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES } from '../shared/uploadLimits'
import {
  MAX_REPORT_IMAGE_EDGE,
  REPORT_IMAGES_DIR,
  type NormalizedImage,
  findOrphanImagePaths,
  normalizeReportImage,
  readStoredImageSize,
  reportImagePath
} from './reportImages'

// EXIF orientation 6: the camera was turned 90° clockwise, so the stored
// pixels are on their side and a viewer must rotate them.
const ORIENTATION_ROTATE_90 = 6

function solidImage(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: '#3366cc' }
  })
}

// A phone photo: EXIF data with camera details and a GPS position.
function photoWithLocation(width: number, height: number): Promise<Buffer> {
  return solidImage(width, height)
    .withExif({
      IFD0: { Make: 'PhoneCo', Model: 'Phone 1' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1' }
    })
    .jpeg()
    .toBuffer()
}

function expectImage(result: NormalizedImage | Error): NormalizedImage {
  expect(result).not.toBeInstanceOf(Error)
  return result as NormalizedImage
}

describe('normalizeReportImage', () => {
  it('encodes WebP and keeps a small image at its size', async () => {
    const input = await solidImage(800, 600).png().toBuffer()
    const image = expectImage(await normalizeReportImage(input))
    expect([image.width, image.height]).toEqual([800, 600])
    expect((await sharp(image.data).metadata()).format).toBe('webp')
  })

  it('limits the longest side and keeps the aspect ratio', async () => {
    const input = await solidImage(4800, 3600).jpeg().toBuffer()
    const image = expectImage(await normalizeReportImage(input))
    expect([image.width, image.height]).toEqual([MAX_REPORT_IMAGE_EDGE, 1800])
  })

  it('limits a portrait image by its height', async () => {
    const input = await solidImage(1200, 4800).jpeg().toBuffer()
    const image = expectImage(await normalizeReportImage(input))
    expect([image.width, image.height]).toEqual([600, MAX_REPORT_IMAGE_EDGE])
  })

  it('removes EXIF data, including the GPS position', async () => {
    const input = await photoWithLocation(400, 300)
    expect((await sharp(input).metadata()).exif).toBeDefined()

    const image = expectImage(await normalizeReportImage(input))
    const output = await sharp(image.data).metadata()
    expect(output.exif).toBeUndefined()
    expect(output.orientation).toBeUndefined()
  })

  it('turns an image the correct way up from its EXIF orientation', async () => {
    const input = await solidImage(400, 200)
      .withMetadata({ orientation: ORIENTATION_ROTATE_90 })
      .jpeg()
      .toBuffer()
    const image = expectImage(await normalizeReportImage(input))
    expect([image.width, image.height]).toEqual([200, 400])
  })

  it('keeps the output under the committed image size limit', async () => {
    const input = await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: '#808080',
        noise: { type: 'gaussian', mean: 128, sigma: 30 }
      }
    })
      .jpeg()
      .toBuffer()
    const result = await normalizeReportImage(input)
    // Pure noise is the worst case for WebP. It either fits or the sync
    // fails with a clear reason. It never writes an oversized file.
    if (result instanceof Error) {
      expect(result.message).toContain('MB limit')
    } else {
      expect(result.data.length).toBeLessThanOrEqual(MAX_IMAGE_BYTES)
    }
  })

  it('accepts WebP and AVIF input', async () => {
    for (const encode of ['webp', 'avif'] as const) {
      const input = await solidImage(100, 100)[encode]().toBuffer()
      expectImage(await normalizeReportImage(input))
    }
  })

  it('fails on a file that is not an image', async () => {
    const result = await normalizeReportImage(
      Buffer.from('%PDF-1.7 not an image')
    )
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('cannot read the image')
  })

  it('fails on a truncated image', async () => {
    const input = await solidImage(400, 300).jpeg().toBuffer()
    const result = await normalizeReportImage(
      input.subarray(0, input.length / 3)
    )
    expect(result).toBeInstanceOf(Error)
  })

  it('fails on a GIF, whatever Airtable said its type was', async () => {
    const input = await solidImage(10, 10).gif().toBuffer()
    const result = await normalizeReportImage(input)
    expect((result as Error).message).toContain('not a JPEG, PNG, WebP or AVIF')
  })
})

describe('reportImagePath', () => {
  it('builds a site path under the report folder', () => {
    expect(reportImagePath('rec1', 'att1')).toBe(
      `${REPORT_IMAGES_DIR}/rec1/att1.webp`
    )
    expect(REPORT_IMAGES_DIR).toBe('/img/grantee-reports')
  })
})

describe('findOrphanImagePaths', () => {
  it('returns the stored files that no report uses', () => {
    const used = new Set([reportImagePath('rec1', 'att1')])
    const stored = [
      reportImagePath('rec1', 'att1'),
      reportImagePath('rec1', 'attOld'),
      reportImagePath('rec2', 'att2')
    ]
    expect(findOrphanImagePaths(stored, used)).toEqual([
      reportImagePath('rec1', 'attOld'),
      reportImagePath('rec2', 'att2')
    ])
  })

  it('returns nothing when nothing is stored', () => {
    expect(findOrphanImagePaths([], new Set())).toEqual([])
  })
})

describe('readStoredImageSize', () => {
  let dir: string | undefined

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('reads the width and height of a stored file', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'report-images-'))
    const file = path.join(dir, 'a.webp')
    await writeFile(file, await solidImage(320, 240).webp().toBuffer())
    expect(await readStoredImageSize(file)).toEqual({ width: 320, height: 240 })
  })

  it('returns an error for a missing file', async () => {
    expect(await readStoredImageSize('/nonexistent/a.webp')).toBeInstanceOf(
      Error
    )
  })
})
