/**
 * ImageBlock component handler for the MDX block parser.
 *
 * Inverse of image-block.serializer.ts:
 *   <ImageBlock src="/img/..." alt="..." tabletSrc="..." mobileSrc="..."
 *               needsFullView={true} needsOutline={true} />
 *
 * The image sources are repo asset paths (/img/...) that bootstrap seeds into
 * Strapi's media library; each is resolved to an upload integer ID via
 * ctx.resolveMediaUpload. `needsFullView` / `needsOutline` are required on the
 * schema (default false). Kept symmetric with the serializer so blocks
 * round-trip.
 */

import type { JsxBlockNode } from './mdxBlockParser'
import type { ImageBlockBlock, ParsedBlock } from './types.blocks'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'
import { getStringAttr, getBooleanAttr } from './jsxExtract'
import { registerComponentHandler, type ParserContext } from './mdxBlockParser'

async function handleImageBlock(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    if (!ctx.resolveMediaUpload) {
      throw new MdxParserError({
        code: ParserErrorCode.UNRESOLVED_RELATION,
        message:
          'resolveMediaUpload is required to import ImageBlock media but was not provided.',
        component: 'ImageBlock'
      })
    }
    const resolveMedia = ctx.resolveMediaUpload

    const src = getStringAttr(node, 'src', { required: true })
    const alt = getStringAttr(node, 'alt')
    const tabletSrc = getStringAttr(node, 'tabletSrc')
    const mobileSrc = getStringAttr(node, 'mobileSrc')

    const block: ImageBlockBlock = {
      __component: 'blocks.image-block',
      image: await resolveMedia(src),
      needsFullView: getBooleanAttr(node, 'needsFullView') ?? false,
      needsOutline: getBooleanAttr(node, 'needsOutline') ?? false
    }

    if (alt) block.altText = alt
    if (tabletSrc) block.tabletImage = await resolveMedia(tabletSrc)
    if (mobileSrc) block.mobileImage = await resolveMedia(mobileSrc)

    return [block]
  })
}

// Registration (runs on import)
registerComponentHandler('ImageBlock', handleImageBlock)
