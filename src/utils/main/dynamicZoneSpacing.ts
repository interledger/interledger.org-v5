/**
 * Spacing between blocks in the Strapi preview (DynamicZone.astro). On a live
 * MDX page prose/rhythm.css does this job; the two must place a block in the
 * same spot, so the cases here mirror that file's rules.
 */

/**
 * Blocks that keep their own margin. Only a block that renders in both the
 * preview and an exported MDX page belongs here: in MDX there is no wrapper,
 * so the component's own margin is the only spacing it gets.
 *
 * CtaButtons switches to intro-block spacing only when it has an intro, so it
 * stays here rather than in SELF_SPACED_BLOCKS: the preview keeps its usual
 * tight pairing, and is only approximate for a CtaButtons with an intro.
 */
export const OWNS_ITS_SPACING: ReadonlySet<string> = new Set([
  'blocks.cta-buttons'
])

/**
 * Blocks that render a `BlockIntro` and set `data-intro-variant` on their
 * root (INTORG-1154). They own their top (the intro) and bottom
 * (`--block-pb`) edges, so they sit out the section gap. Add a block's
 * `__component` here when it adopts the intro.
 */
export const SELF_SPACED_BLOCKS: ReadonlySet<string> = new Set([
  'blocks.blockquote',
  'blocks.card-grid',
  'blocks.carousel',
  'blocks.event-card',
  'blocks.faq',
  'blocks.image-block',
  'blocks.number-tiles',
  'blocks.pdf-embed',
  'blocks.profile-grid',
  'blocks.quote',
  'blocks.video-embed'
])

const SECTION_GAP = 'mt-section'
// A legacy block before a self-spaced one stands in for the padding-bottom
// it doesn't have yet.
const BLOCK_PADDING_GAP = 'mt-(--block-pb)'
// After a self-spaced block, the section gap less the padding it already has.
const SECTION_GAP_AFTER_SELF_SPACED =
  'mt-[calc(var(--space-section)-var(--block-pb))]'

/**
 * Class for the wrapper margin above a preview block, or `null` for none.
 * `prevUid` is `null` for the first block.
 */
export function getPreviewBlockGapClass(
  uid: string,
  prevUid: string | null,
  selfSpacedBlocks: ReadonlySet<string> = SELF_SPACED_BLOCKS
): string | null {
  if (prevUid === null) return null
  if (OWNS_ITS_SPACING.has(uid)) return null
  // Consecutive Paragraphs are running text, not section breaks. Inner `p`
  // already carries the 32px prose gap (prose/default.css).
  if (uid === 'blocks.paragraph' && prevUid === 'blocks.paragraph') return null

  const isSelfSpaced = selfSpacedBlocks.has(uid)
  const prevIsSelfSpaced = selfSpacedBlocks.has(prevUid)
  if (isSelfSpaced) return prevIsSelfSpaced ? null : BLOCK_PADDING_GAP
  return prevIsSelfSpaced ? SECTION_GAP_AFTER_SELF_SPACED : SECTION_GAP
}
