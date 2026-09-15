/**
 * InternalAdvert component handler for the MDX block parser.
 *
 * Inverse of internal-advert.serializer.ts:
 *   <InternalAdvert
 *     helperText="Know more"            (optional)
 *     logo="/uploads/…" logoAlt="…"     (optional)
 *     logoLabel="Web Monetization"      (optional)
 *     headline="…"                      (optional)
 *     socialLinks={["https://…"]}       (optional)
 *     buttonText="…" buttonLink="…"     (optional)
 *   >body markdown</InternalAdvert>
 *
 * Maps to Strapi blocks.internal-advert. The body comes from the JSX children;
 * everything else comes from attributes. The logo path is resolved to an upload
 * integer ID via ctx.resolveMediaUpload, the same way ImageBlock does it.
 *
 * Every field is optional on its own, so the rules that keep the card coherent
 * are cross-field and cannot live in the schema JSON. They are checked here so
 * bad MDX never reaches Strapi, and again in the serializer so an editor
 * working in the admin hits the same rules.
 */

import type { InternalAdvertBlock, ParsedBlock } from './types.blocks'
import { hasConflictingCtaFlags } from './types.blocks'
import { childrenToMarkdown } from './mdastSerialize'
import { getStringAttr, getBooleanAttr, getStringArrayAttr } from './jsxExtract'
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

/** Both numbers come from the ticket (INTORG-824). */
const MIN_ELEMENTS = 3
const TOTAL_ELEMENTS = 6

async function handleInternalAdvert(
  node: JsxBlockNode,
  ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const helperText = getStringAttr(node, 'helperText')?.trim()
    const logoSrc = getStringAttr(node, 'logo')?.trim()
    const logoAlt = getStringAttr(node, 'logoAlt')
    const logoLabel = getStringAttr(node, 'logoLabel')?.trim()
    const headline = getStringAttr(node, 'headline')?.trim()
    const buttonText = getStringAttr(node, 'buttonText')?.trim()
    const buttonLink = getStringAttr(node, 'buttonLink')?.trim()
    const buttonExternal = getBooleanAttr(node, 'buttonExternal')
    const buttonDocument = getBooleanAttr(node, 'buttonDocument')

    const socialUrls = (getStringArrayAttr(node, 'socialLinks') ?? [])
      .map((url) => url.trim())
      .filter(Boolean)

    const body =
      node.children.length > 0 ? childrenToMarkdown(node.children) : ''

    if (
      hasConflictingCtaFlags({
        external: buttonExternal,
        document: buttonDocument
      })
    ) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'InternalAdvert button cannot be both external and document. ' +
          'Pick one: external opens a new tab, document downloads a file.',
        component: 'InternalAdvert',
        prop: 'buttonDocument',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    if (!headline && !body) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'InternalAdvert needs a headline or a body. Everything else on the ' +
          'card is furniture around those two.',
        component: 'InternalAdvert',
        prop: 'headline',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    // A half-specified button would render as a dead or unlabelled control, so
    // it only survives when both halves are present. The flags travel with it.
    const hasButton = Boolean(buttonText && buttonLink)

    const presentElements = [
      Boolean(helperText),
      Boolean(logoSrc) || Boolean(logoLabel),
      Boolean(headline),
      Boolean(body),
      socialUrls.length > 0,
      hasButton
    ].filter(Boolean).length

    if (presentElements < MIN_ELEMENTS) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          `InternalAdvert needs at least ${MIN_ELEMENTS} of its ` +
          `${TOTAL_ELEMENTS} elements filled in. It has ${presentElements}.`,
        component: 'InternalAdvert',
        line: node.position?.start.line,
        column: node.position?.start.column
      })
    }

    const block: InternalAdvertBlock = {
      __component: 'blocks.internal-advert'
    }

    if (helperText) block.helperText = helperText

    if (logoSrc) {
      if (!ctx.resolveMediaUpload) {
        throw new MdxParserError({
          code: ParserErrorCode.UNRESOLVED_RELATION,
          message:
            'resolveMediaUpload is required to import InternalAdvert media but was not provided.',
          component: 'InternalAdvert'
        })
      }
      block.logo = {
        image: await ctx.resolveMediaUpload(logoSrc),
        // null when the attribute is omitted so the serializer can fall back to
        // the upload's own alternativeText; an explicit logoAlt="" stays '' for
        // a decorative logo whose label already names it.
        alternativeText: logoAlt ?? null
      }
    }

    if (logoLabel) block.logoLabel = logoLabel
    if (headline) block.headline = headline
    if (body) block.body = body
    if (socialUrls.length > 0) {
      block.socialLinks = socialUrls.map((url) => ({ url }))
    }

    if (hasButton) {
      block.buttonText = buttonText
      block.buttonLink = buttonLink
      if (buttonExternal) block.buttonExternal = true
      if (buttonDocument) block.buttonDocument = true
    }

    return [block]
  })
}

// Registration (runs on import)
registerComponentHandler('InternalAdvert', handleInternalAdvert)
