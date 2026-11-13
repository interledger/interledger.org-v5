/**
 * Block props removed in INTORG-1154 (ADR-009). Strapi has no field for them
 * any more, so a handler that read past one would drop the heading or button
 * on the next export. The parser rejects them before the handler runs.
 */

import type { JsxBlockNode } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

const INTRO_HINT = 'Move it into intro={{"heading":"…"}}.'
const BUTTONS_HINT = 'Move it into buttons={[{"text":"…","link":"…"}]}.'

/** Each block that takes an intro, and the heading prop the intro replaced. */
export const RETIRED_HEADING_PROPS: Readonly<Record<string, string>> = {
  CardGrid: 'title',
  EventCard: 'title',
  Faq: 'heading',
  LogoCarousel: 'heading',
  NumberTiles: 'title',
  ProfileGrid: 'heading'
}

export const SPLIT_LAYOUT = 'SplitLayout'

/** The single Split layout CTA that the `buttons` group replaced. */
export const RETIRED_SPLIT_LAYOUT_CTA_PROPS = [
  'ctaText',
  'ctaLink',
  'ctaStyle',
  'ctaExternal',
  'ctaDocument'
] as const

/** The retired props on a block named `name`, with how to fix them. */
export function retiredPropsOf(
  name: string | null
): { names: readonly string[]; hint: string } | null {
  if (name === SPLIT_LAYOUT) {
    return { names: RETIRED_SPLIT_LAYOUT_CTA_PROPS, hint: BUTTONS_HINT }
  }
  const heading = name ? RETIRED_HEADING_PROPS[name] : undefined
  return heading ? { names: [heading], hint: INTRO_HINT } : null
}

/** The first retired prop on a block, as a parser error, or `null`. */
export function findRetiredProp(node: JsxBlockNode): MdxParserError | null {
  const retired = retiredPropsOf(node.name)
  if (!retired) return null

  const attr = node.attributes.find(
    (candidate) =>
      candidate.type === 'mdxJsxAttribute' &&
      retired.names.includes(candidate.name)
  )
  if (!attr || attr.type !== 'mdxJsxAttribute') return null

  return new MdxParserError({
    code: ParserErrorCode.UNEXPECTED_PROP,
    message: `${node.name} no longer takes "${attr.name}". ${retired.hint} Run \`pnpm exec tsx scripts/migrate-block-intro.ts\` from cms/ to fix the clean cases.`,
    component: node.name ?? undefined,
    prop: attr.name,
    line: attr.position?.start.line ?? node.position?.start.line,
    column: attr.position?.start.column ?? node.position?.start.column
  })
}
