/**
 * Reads a `buttons={[{ text, link, style?, external?, document? }]}` prop:
 * the CTA button group shared by CtaButtons and SplitLayout. Validates each
 * button and the group's composition rules, and throws `MdxParserError` on a
 * bad shape so the sync fails rather than storing a broken group.
 */

import {
  hasConflictingCtaFlags,
  isCtaButtonStyle,
  validateCtaButtonComposition,
  type CtaButton
} from './types.blocks'
import { getStaticLiteralAttr } from './jsxExtract'
import type { JsxBlockNode } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

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

/**
 * The validated, trimmed buttons, or `undefined` when the prop is absent and
 * not `required`.
 */
export function getCtaButtonsAttr(
  node: JsxBlockNode,
  { required = false }: { required?: boolean } = {}
): CtaButton[] | undefined {
  const fail = (message: string): never => {
    throw new MdxParserError({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      message,
      component: node.name ?? undefined,
      prop: 'buttons',
      line: node.position?.start.line,
      column: node.position?.start.column
    })
  }

  const raw = getStaticLiteralAttr(node, 'buttons', { required })
  if (raw === undefined) return undefined

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

  return buttons
}
