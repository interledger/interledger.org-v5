/**
 * LogoCarousel component handler for the MDX block parser. Handles:
 * <LogoCarousel heading="..." accessibilityLabel="..." logos={[{ name, src }, ...]} />
 *
 * `logos` isn't JSON — Prettier reformats it to JS object-literal syntax on write —
 * so it's extracted via getStaticLiteralAttr's ESTree evaluator, not JSON.parse.
 */

import type { ParsedBlock, CarouselBlock } from './types.blocks'
import { getStringAttr, getStaticLiteralAttr } from './jsxExtract'
import { registerComponentHandler, type ParserContext } from './mdxBlockParser'
import type { JsxBlockNode } from './mdxBlockParser'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'

interface LogoEntry {
  name: string | null
  src: string
}

function isLogoEntry(value: unknown): value is LogoEntry {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const hasValidName =
    record.name === undefined ||
    record.name === null ||
    typeof record.name === 'string'
  return typeof record.src === 'string' && record.src.length > 0 && hasValidName
}

async function handleCarousel(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const heading = getStringAttr(node, 'heading')
    const accessibilityLabel = getStringAttr(node, 'accessibilityLabel', {
      required: true
    })
    const rawLogos = getStaticLiteralAttr(node, 'logos', { required: true })

    if (!Array.isArray(rawLogos) || !rawLogos.every(isLogoEntry)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: 'Prop "logos" must be an array of { name, src } objects.',
        component: 'LogoCarousel',
        prop: 'logos',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (!ctx.resolveMediaUpload) {
      throw new MdxParserError({
        code: ParserErrorCode.UNRESOLVED_RELATION,
        message:
          'resolveMediaUpload is required for LogoCarousel logos but was not provided.',
        component: 'LogoCarousel'
      })
    }

    const logos = await Promise.all(
      rawLogos.map(async (logo) => {
        const id = await ctx.resolveMediaUpload!(logo.src)
        // '' means "explicitly no alt text" in Strapi (see carousel.serializer.ts)
        await ctx.updateMediaAlt?.(id, logo.name || null)
        return id
      })
    )

    const block: CarouselBlock = {
      __component: 'blocks.carousel',
      ...(heading ? { heading } : {}),
      accessibilityLabel,
      logos
    }

    return [block]
  })
}

registerComponentHandler('LogoCarousel', handleCarousel)
