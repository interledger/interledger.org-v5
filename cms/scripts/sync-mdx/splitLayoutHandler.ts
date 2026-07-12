/**
 * SplitLayout component handler for the MDX block parser.
 *
 * Handles:
 * - <SplitLayout imagePosition="left|right" imageSrc="..." imageAlt="..."
 *     videoUrl="..." quote="..." quoteSource="..."
 *     ctaText="..." ctaLink="..." ctaStyle="..." ctaExternal={true}>
 *   children (markdown body for the content column)
 *   </SplitLayout>
 *
 * Maps to Strapi blocks.split-layout.
 * imageSrc is resolved to a Strapi upload ID via resolveMediaUpload.
 * imageAlt has no destination on blocks.split-layout — alt text lives on the
 * Strapi Upload record itself, not the component — so it is read (to keep
 * the MDX/Astro-facing prop contract) but not sent to Strapi.
 */

import type { ParsedBlock, SplitLayoutBlock } from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr, getBooleanAttr } from './jsxExtract'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'

async function handleSplitLayout(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const imagePosition = getStringAttr(node, 'imagePosition') ?? 'right'
    if (imagePosition !== 'left' && imagePosition !== 'right') {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `SplitLayout "imagePosition" must be "left" or "right". Received "${imagePosition}".`,
        component: 'SplitLayout',
        prop: 'imagePosition',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const imageSrc = getStringAttr(node, 'imageSrc')
    const videoUrl = getStringAttr(node, 'videoUrl')
    const quote = getStringAttr(node, 'quote')
    const quoteSource = getStringAttr(node, 'quoteSource')
    const ctaText = getStringAttr(node, 'ctaText')
    const ctaLink = getStringAttr(node, 'ctaLink')
    const ctaStyle = getStringAttr(node, 'ctaStyle')
    const ctaExternal = getBooleanAttr(node, 'ctaExternal')

    const content =
      node.children.length > 0 ? childrenToMarkdown(node.children) : undefined

    let imageId: number | null = null
    if (imageSrc) {
      if (!ctx.resolveMediaUpload) {
        throw new MdxParserError({
          code: ParserErrorCode.MISSING_REQUIRED_PROP,
          message:
            'SplitLayout with imageSrc requires a resolveMediaUpload function on the parser context.',
          component: 'SplitLayout',
          prop: 'imageSrc'
        })
      }
      imageId = await ctx.resolveMediaUpload(imageSrc)
    }

    const isVideo = Boolean(videoUrl)
    const isQuote = Boolean(quote)
    const layoutType: SplitLayoutBlock['layoutType'] = isVideo
      ? isQuote
        ? 'video-quote'
        : 'video-text'
      : isQuote
        ? 'image-quote'
        : 'image-text'

    const block: SplitLayoutBlock = {
      __component: 'blocks.split-layout',
      layoutType,
      imagePosition: imagePosition as 'left' | 'right'
    }

    if (imageId) block.image = imageId
    if (videoUrl) block.videoUrl = videoUrl
    if (content) block.content = content
    if (quote) block.quote = quote
    if (quoteSource) block.quoteSource = quoteSource

    if (ctaText && ctaLink) {
      block.cta = {
        text: ctaText,
        link: ctaLink,
        ...(ctaStyle ? { style: ctaStyle } : {}),
        ...(ctaExternal ? { external: true } : {})
      }
    }

    return [block]
  })
}

registerComponentHandler('SplitLayout', handleSplitLayout)
