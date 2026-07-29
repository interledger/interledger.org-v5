/**
 * FooterNotes component handler for the MDX block parser. Handles:
 * <FooterNotes notes={[{ text, linkText?, linkUrl? }, ...]} />
 *
 * `notes` isn't JSON — Prettier reformats it to JS object-literal syntax on
 * write — so it's extracted via getStaticLiteralAttr's ESTree evaluator, not
 * JSON.parse. No media resolution needed: every field is plain text.
 */

import type { ParsedBlock, FooterNotesBlock } from './types.blocks'
import { getStaticLiteralAttr } from './jsxExtract'
import { registerComponentHandler } from './mdxBlockParser'
import type { JsxBlockNode, ParserContext } from './mdxBlockParser'
import {
  MdxParserError,
  ParserErrorCode,
  tryCatchParserError
} from './parserErrors'

const MIN_NOTES = 1

interface NoteEntry {
  text: string
  linkText?: string
  linkUrl?: string
}

function isNoteEntry(value: unknown): value is NoteEntry {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const hasValidLinkText =
    record.linkText === undefined ||
    (typeof record.linkText === 'string' && record.linkText.trim().length > 0)
  const hasValidLinkUrl =
    record.linkUrl === undefined ||
    (typeof record.linkUrl === 'string' && record.linkUrl.trim().length > 0)
  const hasCompleteLinkPair =
    (record.linkText === undefined) === (record.linkUrl === undefined)
  return (
    typeof record.text === 'string' &&
    record.text.trim().length > 0 &&
    hasValidLinkText &&
    hasValidLinkUrl &&
    hasCompleteLinkPair
  )
}

async function handleFooterNotes(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const rawNotes = getStaticLiteralAttr(node, 'notes', { required: true })

    if (!Array.isArray(rawNotes) || !rawNotes.every(isNoteEntry)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'Prop "notes" must be an array of { text, linkText?, linkUrl? } objects, with linkText/linkUrl both present or both absent.',
        component: 'FooterNotes',
        prop: 'notes',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (rawNotes.length < MIN_NOTES) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `Prop "notes" requires at least ${MIN_NOTES} note.`,
        component: 'FooterNotes',
        prop: 'notes',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: FooterNotesBlock = {
      __component: 'blocks.footer-notes',
      notes: rawNotes.map((note) => {
        const text = note.text.trim()
        const linkText = note.linkText?.trim()
        const linkUrl = note.linkUrl?.trim()
        return {
          text,
          ...(linkText && linkUrl ? { linkText, linkUrl } : {})
        }
      })
    }

    return [block]
  })
}

registerComponentHandler('FooterNotes', handleFooterNotes)
