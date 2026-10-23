import { describe, expect, it } from 'vitest'
import { getPreviewBlockGapClass } from './dynamicZoneSpacing'

const SELF_SPACED = new Set(['blocks.faq', 'blocks.card-grid'])

describe('getPreviewBlockGapClass', () => {
  it('gives the first block no gap', () => {
    expect(getPreviewBlockGapClass('blocks.faq', null, SELF_SPACED)).toBeNull()
    expect(getPreviewBlockGapClass('blocks.code-block', null)).toBeNull()
  })

  it('separates two legacy blocks by the section gap', () => {
    expect(
      getPreviewBlockGapClass('blocks.code-block', 'blocks.callout-text')
    ).toBe('mt-section')
  })

  it('lets CtaButtons keep its own spacing', () => {
    expect(
      getPreviewBlockGapClass('blocks.cta-buttons', 'blocks.paragraph')
    ).toBeNull()
  })

  it('runs consecutive Paragraphs together', () => {
    expect(
      getPreviewBlockGapClass('blocks.paragraph', 'blocks.paragraph')
    ).toBeNull()
  })

  it('adds nothing between two self-spaced blocks', () => {
    expect(
      getPreviewBlockGapClass('blocks.faq', 'blocks.card-grid', SELF_SPACED)
    ).toBeNull()
  })

  it('stands in for the missing padding before a self-spaced block', () => {
    expect(
      getPreviewBlockGapClass('blocks.faq', 'blocks.paragraph', SELF_SPACED)
    ).toBe('mt-(--block-pb)')
  })

  // In the preview a CTA is the last child of its wrapper, so its own
  // `[&:last-child]:mb-0` already drops its bottom margin.
  it('treats a CTA before a self-spaced block like any legacy block', () => {
    expect(
      getPreviewBlockGapClass('blocks.faq', 'blocks.cta-buttons', SELF_SPACED)
    ).toBe('mt-(--block-pb)')
  })

  it('takes the self-spaced padding off the gap after one', () => {
    expect(
      getPreviewBlockGapClass('blocks.paragraph', 'blocks.faq', SELF_SPACED)
    ).toBe('mt-[calc(var(--space-section)-var(--block-pb))]')
  })
})
