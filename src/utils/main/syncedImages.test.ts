import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES } from '../shared/uploadLimits'
import {
  MAX_LOGO_EDGE,
  MAX_REPORT_IMAGE_EDGE,
  PROFILE_IMAGES_DIR,
  REPORT_IMAGES_DIR,
  type NormalizedImage,
  findOrphanImagePaths,
  normalizeSyncedImage,
  readStoredImageSize,
  syncedImagePath
} from './syncedImages'

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

describe('normalizeSyncedImage', () => {
  it('encodes WebP and keeps a small image at its size', async () => {
    const input = await solidImage(800, 600).png().toBuffer()
    const image = expectImage(
      await normalizeSyncedImage(input, MAX_REPORT_IMAGE_EDGE)
    )
    expect([image.width, image.height]).toEqual([800, 600])
    expect((await sharp(image.data).metadata()).format).toBe('webp')
  })

  it('limits the longest side and keeps the aspect ratio', async () => {
    const input = await solidImage(4800, 3600).jpeg().toBuffer()
    const image = expectImage(
      await normalizeSyncedImage(input, MAX_REPORT_IMAGE_EDGE)
    )
    expect([image.width, image.height]).toEqual([MAX_REPORT_IMAGE_EDGE, 1800])
  })

  it('limits a portrait image by its height', async () => {
    const input = await solidImage(1200, 4800).jpeg().toBuffer()
    const image = expectImage(
      await normalizeSyncedImage(input, MAX_REPORT_IMAGE_EDGE)
    )
    expect([image.width, image.height]).toEqual([600, MAX_REPORT_IMAGE_EDGE])
  })

  it('limits a logo to the logo edge', async () => {
    const input = await solidImage(3000, 1500).png().toBuffer()
    const image = expectImage(await normalizeSyncedImage(input, MAX_LOGO_EDGE))
    expect([image.width, image.height]).toEqual([MAX_LOGO_EDGE, 512])
  })

  it('keeps the transparency of a PNG logo', async () => {
    const input = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .png()
      .toBuffer()
    const image = expectImage(await normalizeSyncedImage(input, MAX_LOGO_EDGE))
    expect((await sharp(image.data).metadata()).hasAlpha).toBe(true)
  })

  it('removes EXIF data, including the GPS position', async () => {
    const input = await photoWithLocation(400, 300)
    expect((await sharp(input).metadata()).exif).toBeDefined()

    const image = expectImage(
      await normalizeSyncedImage(input, MAX_REPORT_IMAGE_EDGE)
    )
    const output = await sharp(image.data).metadata()
    expect(output.exif).toBeUndefined()
    expect(output.orientation).toBeUndefined()
  })

  it('turns an image the correct way up from its EXIF orientation', async () => {
    const input = await solidImage(400, 200)
      .withMetadata({ orientation: ORIENTATION_ROTATE_90 })
      .jpeg()
      .toBuffer()
    const image = expectImage(
      await normalizeSyncedImage(input, MAX_REPORT_IMAGE_EDGE)
    )
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
    const result = await normalizeSyncedImage(input, MAX_REPORT_IMAGE_EDGE)
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
      expectImage(await normalizeSyncedImage(input, MAX_REPORT_IMAGE_EDGE))
    }
  })

  it('fails on a file that is not an image', async () => {
    const result = await normalizeSyncedImage(
      Buffer.from('%PDF-1.7 not an image'),
      MAX_REPORT_IMAGE_EDGE
    )
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('cannot read the image')
  })

  it('fails on a truncated image', async () => {
    const input = await solidImage(400, 300).jpeg().toBuffer()
    const result = await normalizeSyncedImage(
      input.subarray(0, input.length / 3),
      MAX_REPORT_IMAGE_EDGE
    )
    expect(result).toBeInstanceOf(Error)
  })

  it('fails on a GIF, whatever Airtable said its type was', async () => {
    const input = await solidImage(10, 10).gif().toBuffer()
    const result = await normalizeSyncedImage(input, MAX_REPORT_IMAGE_EDGE)
    expect((result as Error).message).toContain('not a JPEG, PNG, WebP or AVIF')
  })
})

describe('syncedImagePath', () => {
  it('builds a site path under the report folder', () => {
    expect(syncedImagePath(REPORT_IMAGES_DIR, 'rec1', 'att1')).toBe(
      `${REPORT_IMAGES_DIR}/rec1/att1.webp`
    )
    expect(REPORT_IMAGES_DIR).toBe('/img/grantee-reports')
    expect(syncedImagePath(PROFILE_IMAGES_DIR, 'rec2', 'att2')).toBe(
      '/img/grantee-profiles/rec2/att2.webp'
    )
  })
})

describe('findOrphanImagePaths', () => {
  it('returns the stored files that no report uses', () => {
    const used = new Set([syncedImagePath(REPORT_IMAGES_DIR, 'rec1', 'att1')])
    const stored = [
      syncedImagePath(REPORT_IMAGES_DIR, 'rec1', 'att1'),
      syncedImagePath(REPORT_IMAGES_DIR, 'rec1', 'attOld'),
      syncedImagePath(REPORT_IMAGES_DIR, 'rec2', 'att2')
    ]
    expect(findOrphanImagePaths(stored, used)).toEqual([
      syncedImagePath(REPORT_IMAGES_DIR, 'rec1', 'attOld'),
      syncedImagePath(REPORT_IMAGES_DIR, 'rec2', 'att2')
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
