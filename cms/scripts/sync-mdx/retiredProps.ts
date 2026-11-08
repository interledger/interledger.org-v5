/**
 * Block props removed in INTORG-1154 (ADR-009). Strapi has no field for them
 * any more, so a handler that read past one would drop the heading or button
 * on the next export. The parser rejects them before the handler runs.
 */

import type { JsxBlockNode } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

const INTRO_HINT = 'Move it into intro={{"heading":"…"}}.'
const BUTTONS_HINT = 'Move it into buttons={[{"text":"…","link":"…"}]}.'

interface RetiredProps {
  names: readonly string[]
  hint: string
}

/** Each block and the props it no longer takes. */
export const RETIRED_BLOCK_PROPS: Readonly<Record<string, RetiredProps>> = {
  CardGrid: { names: ['title'], hint: INTRO_HINT },
  EventCard: { names: ['title'], hint: INTRO_HINT },
  Faq: { names: ['heading'], hint: INTRO_HINT },
  LogoCarousel: { names: ['heading'], hint: INTRO_HINT },
  NumberTiles: { names: ['title'], hint: INTRO_HINT },
  ProfileGrid: { names: ['heading'], hint: INTRO_HINT },
  SplitLayout: {
    names: ['ctaText', 'ctaLink', 'ctaStyle', 'ctaExternal', 'ctaDocument'],
    hint: BUTTONS_HINT
  }
}

/** The first retired prop on a block, as a parser error, or `null`. */
export function findRetiredProp(node: JsxBlockNode): MdxParserError | null {
  const retired = node.name ? RETIRED_BLOCK_PROPS[node.name] : undefined
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
