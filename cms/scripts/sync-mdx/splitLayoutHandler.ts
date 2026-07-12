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
 * imageAlt maps to blocks.split-layout.imageAlt so alt text remains scoped to
 * this component instead of mutating the shared Strapi upload record.
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
    const layoutTypeAttr = getStringAttr(node, 'layoutType')
    if (layoutTypeAttr !== undefined && !isSplitLayoutType(layoutTypeAttr)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `SplitLayout "layoutType" must be "image-text", "image-quote", "video-text", or "video-quote". Received "${layoutTypeAttr}".`,
        component: 'SplitLayout',
        prop: 'layoutType',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

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
    const imageAlt = getStringAttr(node, 'imageAlt')
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

    const inferredLayoutType: SplitLayoutBlock['layoutType'] = videoUrl
      ? quote
        ? 'video-quote'
        : 'video-text'
      : quote
        ? 'image-quote'
        : 'image-text'
    const layoutType = layoutTypeAttr ?? inferredLayoutType
    const isImageLayout = layoutType.startsWith('image')
    const isVideoLayout = layoutType.startsWith('video')
    const isTextLayout = layoutType.endsWith('-text')
    const isQuoteLayout = layoutType.endsWith('-quote')

    const block: SplitLayoutBlock = {
      __component: 'blocks.split-layout',
      layoutType,
      imagePosition: imagePosition as 'left' | 'right'
    }

    if (isImageLayout && imageId) block.image = imageId
    if (isImageLayout && imageAlt !== undefined) block.imageAlt = imageAlt
    if (isVideoLayout && videoUrl) block.videoUrl = videoUrl
    if (isTextLayout && content) block.content = content
    if (isQuoteLayout && quote) block.quote = quote
    if (isQuoteLayout && quoteSource) block.quoteSource = quoteSource

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

function isSplitLayoutType(
  value: string
): value is SplitLayoutBlock['layoutType'] {
  return (
    value === 'image-text' ||
    value === 'image-quote' ||
    value === 'video-text' ||
    value === 'video-quote'
  )
}
