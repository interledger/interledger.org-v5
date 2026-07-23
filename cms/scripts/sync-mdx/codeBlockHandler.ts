import type { CodeBlockBlock, ParsedBlock } from './types.blocks'
import { getStaticExpressionAttr, getStringAttr } from './jsxExtract'
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

const CODE_BLOCK_LANGUAGES = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'html',
  'css',
  'bash',
  'json',
  'yaml',
  'python',
  'rust',
  'go',
  'sql',
  'markdown',
  'php',
  'java',
  'ini',
  'graphql',
  'http',
  'nginx',
  'xml',
  'webidl',
  'text'
] as const

type CodeBlockLanguage = (typeof CODE_BLOCK_LANGUAGES)[number]

async function handleCodeBlock(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const language = getStringAttr(node, 'language', { required: true })
    const title = getStringAttr(node, 'title')
    const code = getStaticExpressionAttr(node, 'code', {
      required: true,
      sourceText: ctx.sourceText
    })

    if (!CODE_BLOCK_LANGUAGES.includes(language as CodeBlockLanguage)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `Prop "language" must be one of: ${CODE_BLOCK_LANGUAGES.join(', ')}.`,
        component: node.name ?? undefined,
        prop: 'language',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: CodeBlockBlock = {
      __component: 'blocks.code-block',
      code,
      language
    }

    if (title !== undefined) {
      block.title = title
    }

    return [block]
  })
}

registerComponentHandler('CodeBlock', handleCodeBlock)
