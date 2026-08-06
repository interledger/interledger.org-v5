import { describe, expect, it } from 'vitest'
import { TARGET_WIDTHS } from '@/utils/main/imagePaths'
import { FULL_SIZE_SUFFIX, planVariants } from './variantPlan'

describe('planVariants', () => {
  it('emits every target width the source can fill, plus its intrinsic width', () => {
    const plan = planVariants('hero', 1200, TARGET_WIDTHS)

    expect(plan.widths).toEqual([640, 1200])
    expect(plan.variants).toEqual([
      { fileName: 'hero-640.webp', format: 'webp', width: 640 },
      { fileName: 'hero-640.avif', format: 'avif', width: 640 },
      { fileName: 'hero-1200.webp', format: 'webp', width: 1200 },
      { fileName: 'hero-1200.avif', format: 'avif', width: 1200 },
      { fileName: 'hero-full.webp', format: 'webp', width: null },
      { fileName: 'hero-full.avif', format: 'avif', width: null }
    ])
  })

  it('does not duplicate the intrinsic width when it is already a target', () => {
    const plan = planVariants('hero', 1280, TARGET_WIDTHS)

    expect(plan.widths).toEqual([640, 1280])
  })

  it('never upscales past the intrinsic width', () => {
    const plan = planVariants('icon', 400, TARGET_WIDTHS)

    expect(plan.widths).toEqual([400])
    expect(plan.variants.map((v) => v.fileName)).toEqual([
      'icon-400.webp',
      'icon-400.avif',
      'icon-full.webp',
      'icon-full.avif'
    ])
  })

  it('keeps widths ascending for a source wider than every target', () => {
    const plan = planVariants('wide', 4000, TARGET_WIDTHS)

    expect(plan.widths).toEqual([640, 1280, 1920, 2560, 3840, 4000])
  })

  it('plans nothing when the intrinsic width is unknown or nonsensical', () => {
    for (const width of [0, -1]) {
      expect(planVariants('broken', width, TARGET_WIDTHS)).toEqual({
        widths: [],
        variants: []
      })
    }
  })

  it('encodes the full-size pair last and without a resize', () => {
    const plan = planVariants('hero', 1200, TARGET_WIDTHS)
    const fullSize = plan.variants.filter((v) => v.width === null)

    expect(plan.variants.slice(-2)).toEqual(fullSize)
    expect(fullSize.map((v) => v.fileName)).toEqual([
      `hero-${FULL_SIZE_SUFFIX}.webp`,
      `hero-${FULL_SIZE_SUFFIX}.avif`
    ])
  })

  it('keeps dots and dashes in the source name', () => {
    const plan = planVariants('logo.dark-2x', 500, [])

    expect(plan.variants.map((v) => v.fileName)).toEqual([
      'logo.dark-2x-500.webp',
      'logo.dark-2x-500.avif',
      'logo.dark-2x-full.webp',
      'logo.dark-2x-full.avif'
    ])
  })
})
