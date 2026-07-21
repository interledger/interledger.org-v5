/**
 * VideoEmbed component handler for the MDX block parser.
 *
 * Handles:
 * - <VideoEmbed url="https://youtube.com/..." title="..." />   (external)
 * - <VideoEmbed url="https://vimeo.com/..." title="..." />     (external)
 * - <VideoEmbed url="https://cdn.example.com/clip.mp4" ... />  (external direct file)
 * - <VideoEmbed url="/img/blog/clip.mp4" title="..." />        (repo asset, direct URL)
 * - <VideoEmbed url="/uploads/clip.mp4" title="..." />         (Strapi upload)
 *
 * Only `/uploads/` paths are Strapi media uploads and resolve to an integer
 * file ID via ctx.resolveMediaUpload. Everything else — YouTube/Vimeo, external
 * direct URLs, and repo `/img/...` video assets — is stored in externalUrl and
 * plays inline via VideoEmbed.astro's `file` provider branch. (Bootstrap only
 * seeds image extensions into Strapi media, not videos, so a repo `/img/*.mp4`
 * is not a media entity.)
 */

import type { ParsedBlock, VideoEmbedBlock } from './types.blocks'
import { getStringAttr } from './jsxExtract'
import { registerComponentHandler, type ParserContext } from './mdxBlockParser'
import type { JsxBlockNode } from './mdxBlockParser'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'

async function handleVideoEmbed(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const url = getStringAttr(node, 'url', { required: true })
    const title = getStringAttr(node, 'title', { required: true })

    const block: VideoEmbedBlock = {
      __component: 'blocks.video-embed',
      source: url.startsWith('/uploads/') ? 'media_library' : 'external_url',
      title
    }

    if (block.source === 'media_library') {
      // Internal Strapi media upload — resolve to integer file ID
      if (!ctx.resolveMediaUpload) {
        throw new MdxParserError({
          code: ParserErrorCode.UNRESOLVED_RELATION,
          message:
            'resolveMediaUpload is required for internal VideoEmbed URLs but was not provided.',
          component: 'VideoEmbed'
        })
      }
      block.file = await ctx.resolveMediaUpload(url)
    } else {
      block.externalUrl = url
    }

    return [block]
  })
}

registerComponentHandler('VideoEmbed', handleVideoEmbed)
