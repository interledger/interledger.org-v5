/**
 * Moves block headings into the block intro (INTORG-1154, ADR-009) in MDX
 * source, so the repo and Strapi agree before the next sync:
 *
 * - A legacy `title="…"` / `heading="…"` on a block becomes
 *   `intro={{"heading":"…"}}`.
 * - With `fold`, a "fake intro" — a `<Paragraph>` holding only a `##` or
 *   `###` heading and plain description paragraphs, directly before a block
 *   with no heading of its own — moves into that block's intro. Anything
 *   less clean is reported for an editor, never rewritten.
 *
 * Works on source offsets from the MDX parse, so the rest of the file stays
 * byte for byte unchanged and the diff shows only the moved text.
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import type { Root, RootContent } from 'mdast'
import type { MdxJsxAttribute, MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import type { SerializedBlockIntro } from '../src/utils/contentTypes'

/** Blocks that take an intro, and the legacy attribute each one replaces. */
export const INTRO_BLOCK_LEGACY_ATTRS: Readonly<Record<string, string>> = {
  CardGrid: 'title',
  EventCard: 'title',
  Faq: 'heading',
  LogoCarousel: 'heading',
  NumberTiles: 'title',
  ProfileGrid: 'heading'
}

const FAKE_INTRO_WRAPPER = 'Paragraph'

/** YAML frontmatter; a byte-order mark may precede it. */
const FRONTMATTER = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/

/**
 * The source with its frontmatter blanked to spaces, so MDX doesn't parse
 * YAML as markdown while every offset and line number still matches.
 */
function blankFrontmatter(source: string): string {
  return source.replace(FRONTMATTER, (frontmatter) =>
    frontmatter.replace(/[^\r\n]/g, ' ')
  )
}

/** Inline content a description may hold and still fold cleanly. */
const PLAIN_INLINE_TYPES = new Set([
  'text',
  'strong',
  'emphasis',
  'link',
  'inlineCode',
  'break'
])

export interface FakeIntroReport {
  line: number
  block: string
  reason: string
}

export interface BlockIntroMigration {
  /** The rewritten source, or `null` when nothing changed. */
  source: string | null
  /** Fake intros found but left alone, with why. */
  skipped: FakeIntroReport[]
  /** Fake intros folded into their block. */
  folded: FakeIntroReport[]
}

interface Edit {
  start: number
  end: number
  text: string
}

type Offsets = { start: number; end: number }

function offsetsOf(node: {
  position?: { start: { offset?: number }; end: { offset?: number } }
}): Offsets | null {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  return start === undefined || end === undefined ? null : { start, end }
}

function isFlowElement(
  node: RootContent | undefined
): node is MdxJsxFlowElement {
  return node?.type === 'mdxJsxFlowElement'
}

function isIntroBlock(
  node: RootContent | undefined
): node is MdxJsxFlowElement {
  return (
    isFlowElement(node) &&
    node.name !== null &&
    node.name in INTRO_BLOCK_LEGACY_ATTRS
  )
}

function findAttr(
  node: MdxJsxFlowElement,
  name: string
): MdxJsxAttribute | undefined {
  return node.attributes.find(
    (attr): attr is MdxJsxAttribute =>
      attr.type === 'mdxJsxAttribute' && attr.name === name
  )
}

function introAttr(intro: SerializedBlockIntro): string {
  return `intro={${JSON.stringify(intro)}}`
}

/** Offset just after `<Name`, where a new attribute can go. */
function afterTagName(node: MdxJsxFlowElement): number | null {
  const offsets = offsetsOf(node)
  return offsets && node.name ? offsets.start + 1 + node.name.length : null
}

/** Rewrites `title="…"` / `heading="…"` on one block into `intro={…}`. */
function legacyHeadingEdit(node: MdxJsxFlowElement): Edit | null {
  const legacyName = node.name ? INTRO_BLOCK_LEGACY_ATTRS[node.name] : undefined
  if (!legacyName || findAttr(node, 'intro')) return null

  const legacy = findAttr(node, legacyName)
  const offsets = legacy && offsetsOf(legacy)
  if (!legacy || !offsets || typeof legacy.value !== 'string') return null

  const heading = legacy.value.trim()
  return {
    ...offsets,
    text: heading ? introAttr({ heading }) : ''
  }
}

function hasHeading(node: MdxJsxFlowElement): boolean {
  const legacyName = node.name ? INTRO_BLOCK_LEGACY_ATTRS[node.name] : ''
  const legacy = legacyName ? findAttr(node, legacyName) : undefined
  return (
    findAttr(node, 'intro') !== undefined ||
    (typeof legacy?.value === 'string' && legacy.value.trim() !== '')
  )
}

function isPlainInline(node: RootContent): boolean {
  if (!PLAIN_INLINE_TYPES.has(node.type)) return false
  return 'children' in node
    ? (node.children as RootContent[]).every(isPlainInline)
    : true
}

type FoldResult =
  | { intro: SerializedBlockIntro; reason?: undefined }
  | { intro?: undefined; reason: string }

/**
 * Reads a fake intro out of a `<Paragraph>`: a heading first, then only
 * plain paragraphs. Returns why it can't fold otherwise.
 */
function readFakeIntro(
  paragraph: MdxJsxFlowElement,
  source: string
): FoldResult {
  if (paragraph.attributes.length > 0) {
    return { reason: 'the Paragraph has attributes' }
  }
  const [first, ...rest] = paragraph.children
  if (first?.type !== 'heading' || (first.depth !== 2 && first.depth !== 3)) {
    return { reason: 'content comes before the heading' }
  }
  if (!first.children.every((child) => child.type === 'text')) {
    return { reason: 'the heading has formatting or links' }
  }
  const unclean = rest.find(
    (node) => node.type !== 'paragraph' || !node.children.every(isPlainInline)
  )
  if (unclean) {
    return { reason: `the description has a ${unclean.type}` }
  }

  const text = first.children
    .map((child) => child.value)
    .join('')
    .trim()
  const intro: SerializedBlockIntro =
    first.depth === 2 ? { heading: text } : { subheading: text }

  const firstOffsets = rest.length > 0 ? offsetsOf(rest[0]) : null
  const lastOffsets = rest.length > 0 ? offsetsOf(rest[rest.length - 1]) : null
  if (firstOffsets && lastOffsets) {
    intro.description = source.slice(firstOffsets.start, lastOffsets.end).trim()
  }
  return { intro }
}

/** Whether a Paragraph holds a `##`/`###` heading, so it may be a fake intro. */
function looksLikeFakeIntro(paragraph: MdxJsxFlowElement): boolean {
  return paragraph.children.some(
    (child) =>
      child.type === 'heading' && (child.depth === 2 || child.depth === 3)
  )
}

interface FoldPass {
  edits: Edit[]
  folded: FakeIntroReport[]
  skipped: FakeIntroReport[]
  /** Blocks whose legacy-heading edit the fold replaces. */
  foldedBlocks: Set<MdxJsxFlowElement>
}

function foldPass(root: Root, source: string, fold: boolean): FoldPass {
  const pass: FoldPass = {
    edits: [],
    folded: [],
    skipped: [],
    foldedBlocks: new Set()
  }

  root.children.forEach((node, index) => {
    if (!isFlowElement(node) || node.name !== FAKE_INTRO_WRAPPER) return
    const block = root.children[index + 1]
    if (!isIntroBlock(block) || !looksLikeFakeIntro(node)) return

    const line = node.position?.start.line ?? 0
    const report = { line, block: block.name ?? '' }
    if (hasHeading(block)) {
      pass.skipped.push({
        ...report,
        reason: 'the block already has a heading'
      })
      return
    }
    const result = readFakeIntro(node, source)
    if (!result.intro) {
      pass.skipped.push({ ...report, reason: result.reason })
      return
    }
    if (!fold) {
      pass.skipped.push({ ...report, reason: 'foldable; run with --fold' })
      return
    }

    const paragraphOffsets = offsetsOf(node)
    const blockOffsets = offsetsOf(block)
    const insertAt = afterTagName(block)
    if (!paragraphOffsets || !blockOffsets || insertAt === null) return

    pass.edits.push(
      // The Paragraph and the blank lines up to the block.
      { start: paragraphOffsets.start, end: blockOffsets.start, text: '' },
      { start: insertAt, end: insertAt, text: ` ${introAttr(result.intro)}` }
    )
    pass.folded.push({ ...report, reason: 'folded' })
    pass.foldedBlocks.add(block)
  })

  return pass
}

/** Every intro block in the tree, nested ones included. */
function introBlocks(node: Root | RootContent): MdxJsxFlowElement[] {
  const own = isIntroBlock(node as RootContent)
    ? [node as MdxJsxFlowElement]
    : []
  const children = 'children' in node ? (node.children as RootContent[]) : []
  return [...own, ...children.flatMap(introBlocks)]
}

function applyEdits(source: string, edits: Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, edit) =>
        text.slice(0, edit.start) + edit.text + text.slice(edit.end),
      source
    )
}

/**
 * Migrates one MDX file's block headings to block intros. Pass `fold` to
 * also fold clean fake intros; without it they are only reported.
 */
export function migrateBlockIntro(
  source: string,
  { fold = false }: { fold?: boolean } = {}
): BlockIntroMigration | Error {
  let root: Root
  try {
    root = unified()
      .use(remarkParse)
      .use(remarkMdx)
      .parse(blankFrontmatter(source)) as Root
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }

  const pass = foldPass(root, source, fold)
  const legacyEdits = introBlocks(root)
    .filter((block) => !pass.foldedBlocks.has(block))
    .map(legacyHeadingEdit)
    .filter((edit): edit is Edit => edit !== null)

  const edits = [...pass.edits, ...legacyEdits]
  return {
    source: edits.length > 0 ? applyEdits(source, edits) : null,
    folded: pass.folded,
    skipped: pass.skipped
  }
}
