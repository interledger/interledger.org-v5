/**
 * HackathonAnimation component handler for the MDX block parser.
 *
 * Handles: <HackathonAnimation /> — fieldless, self-closing. Maps to
 * Strapi blocks.hackathon-animation. Strict: any attribute or child content
 * would otherwise be silently dropped on export, so both are rejected.
 */

import type { HackathonAnimationBlock, ParsedBlock } from './types.blocks'
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

async function handleHackathonAnimation(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const position = {
      line: node.position?.start.line,
      column: node.position?.start.column
    }

    const [firstAttribute] = node.attributes
    if (firstAttribute) {
      const propName =
        firstAttribute.type === 'mdxJsxAttribute'
          ? firstAttribute.name
          : undefined
      throw new MdxParserError({
        code: ParserErrorCode.UNEXPECTED_PROP,
        message: propName
          ? `HackathonAnimation takes no props, but found "${propName}". Use a plain self-closing <HackathonAnimation />.`
          : 'HackathonAnimation takes no props, but found a spread attribute. Use a plain self-closing <HackathonAnimation />.',
        component: 'HackathonAnimation',
        prop: propName,
        ...position
      })
    }

    if (node.children.length > 0) {
      throw new MdxParserError({
        code: ParserErrorCode.UNEXPECTED_CHILDREN,
        message:
          'HackathonAnimation must be self-closing (<HackathonAnimation />) — it does not accept children.',
        component: 'HackathonAnimation',
        ...position
      })
    }

    const block: HackathonAnimationBlock = {
      __component: 'blocks.hackathon-animation'
    }
    return [block]
  })
}

registerComponentHandler('HackathonAnimation', handleHackathonAnimation)
