import type { ParsedBlock, VideoEmbedBlock } from './types.blocks'
import { getStringAttr } from './jsxExtract'
import { registerComponentHandler, type ParserContext } from './mdxBlockParser'
import type { JsxBlockNode } from './mdxBlockParser'
import { MdxParserError, tryCatchParserError } from './parserErrors'

async function handleVideoEmbed(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const url = getStringAttr(node, 'url', { required: true })
    const title = getStringAttr(node, 'title', { required: true })

    const block: VideoEmbedBlock = {
      __component: 'blocks.video-embed',
      url,
      title
    }

    return [block]
  })
}

registerComponentHandler('VideoEmbed', handleVideoEmbed)
