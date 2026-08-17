/**
 * HackathonAnimation component handler for the MDX block parser.
 *
 * Handles: <HackathonAnimation /> — fieldless, self-closing. Maps to
 * Strapi blocks.hackathon-animation.
 */

import type { HackathonAnimationBlock, ParsedBlock } from './types.blocks'
import {
  registerComponentHandler,
  type JsxBlockNode,
  type ParserContext
} from './mdxBlockParser'
import { MdxParserError, tryCatchParserError } from './parserErrors'

async function handleHackathonAnimation(
  _node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const block: HackathonAnimationBlock = {
      __component: 'blocks.hackathon-animation'
    }
    return [block]
  })
}

registerComponentHandler('HackathonAnimation', handleHackathonAnimation)
