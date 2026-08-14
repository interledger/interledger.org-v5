/**
 * CtaButtons component handler for the MDX block parser.
 *
 * Handles:
 * - <CtaButtons buttons={[{ text, link, style, external, document }, ...]} />
 *
 * Maps to Strapi blocks.cta-buttons. Every field is plain text, so the buttons
 * arrive as a static array prop rather than as child elements (same shape as
 * NumberTiles). `buttons` isn't JSON — Prettier reformats it to JS
 * object-literal syntax on write — so it's read via getStaticLiteralAttr's
 * ESTree evaluator, not JSON.parse.
 */

import {
  hasConflictingCtaFlags,
  isCtaButtonStyle,
  validateCtaButtonComposition,
  type CtaButton,
  type CtaButtonsBlock,
  type ParsedBlock
} from './types.blocks'
import { getStaticLiteralAttr } from './jsxExtract'
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

interface RawButton {
  text: string
  link: string
  style?: string
  external?: boolean
  document?: boolean
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean'
}

function isRawButton(value: unknown): value is RawButton {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isNonEmptyString(record.text) &&
    isNonEmptyString(record.link) &&
    (record.style === undefined || isCtaButtonStyle(record.style)) &&
    isOptionalBoolean(record.external) &&
    isOptionalBoolean(record.document)
  )
}

async function handleCtaButtons(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(() => {
    const fail = (message: string, prop = 'buttons') => {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message,
        component: 'CtaButtons',
        prop,
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const raw = getStaticLiteralAttr(node, 'buttons', { required: true })

    if (!Array.isArray(raw) || !raw.every(isRawButton)) {
      fail(
        'Prop "buttons" must be an array of { text, link, style?, external?, document? } objects. ' +
          '"text" and "link" are required and non-empty; "style" is "primary" or "secondary".'
      )
    }

    // Trim on the way in, the same as numberTilesHandler. The validator above
    // already judges these values trimmed, so storing them raw would let
    // padding survive into Strapi and back out into the next export
    // (Jonathan, #483).
    const buttons: CtaButton[] = (raw as RawButton[]).map((entry) => ({
      text: entry.text.trim(),
      link: entry.link.trim(),
      // Mirror the Strapi schema default so the composition rule and the
      // round-trip both see the same value.
      style: entry.style ?? 'primary',
      ...(entry.external ? { external: true } : {}),
      ...(entry.document ? { document: true } : {})
    }))

    const conflictIndex = buttons.findIndex(hasConflictingCtaFlags)
    if (conflictIndex !== -1) {
      fail(
        `Button ${conflictIndex + 1} cannot be both external and document. ` +
          'Pick one: external opens a new tab, document downloads a file.'
      )
    }

    const ruleError = validateCtaButtonComposition(buttons)
    if (ruleError) fail(ruleError.message)

    const block: CtaButtonsBlock = {
      __component: 'blocks.cta-buttons',
      buttons
    }

    return [block]
  })
}

registerComponentHandler('CtaButtons', handleCtaButtons)
