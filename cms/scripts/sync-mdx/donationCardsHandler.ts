/**
 * DonationCards component handler for the MDX block parser. Handles:
 * <DonationCards ariaLabel="…" cards={[{ heading, amount, benefits, ctaText, ctaLink, … }, ...]} />
 *
 * Maps to Strapi blocks.donation-cards. A tier is a fixed set of plain-text
 * fields, so the cards arrive as a static array prop rather than as child
 * elements — the same shape as NumberTiles and CtaButtons. `cards` isn't JSON
 * (Prettier rewrites it to JS object-literal syntax on write), so it is read
 * through getStaticLiteralAttr's ESTree evaluator, not JSON.parse.
 */

import type { DonationCardsBlock, ParsedBlock } from './types.blocks'
import { getStaticLiteralAttr, getStringAttr } from './jsxExtract'
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

const MIN_CARDS = 1

interface RawCard {
  heading: string
  amount: string
  summary?: string
  seats?: string
  benefitsLabel?: string
  benefits: string
  ctaText: string
  ctaLink: string
  ctaExternal?: boolean
  ctaDocument?: boolean
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Optional text is valid when omitted or non-blank: an empty string would
 * round-trip to Strapi as a field that renders nothing. */
function isOptionalText(value: unknown): boolean {
  return value === undefined || isNonEmptyString(value)
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean'
}

function isRawCard(value: unknown): value is RawCard {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isNonEmptyString(record.heading) &&
    isNonEmptyString(record.amount) &&
    isNonEmptyString(record.benefits) &&
    isNonEmptyString(record.ctaText) &&
    isNonEmptyString(record.ctaLink) &&
    isOptionalText(record.summary) &&
    isOptionalText(record.seats) &&
    isOptionalText(record.benefitsLabel) &&
    isOptionalBoolean(record.ctaExternal) &&
    isOptionalBoolean(record.ctaDocument)
  )
}

async function handleDonationCards(
  node: JsxBlockNode,
  _ctx: ParserContext
): Promise<ParsedBlock[] | MdxParserError> {
  return tryCatchParserError(async () => {
    const position = {
      line: node.position?.start.line,
      column: node.position?.start.column
    }

    const ariaLabel = getStringAttr(node, 'ariaLabel', { required: true })
    const rawCards = getStaticLiteralAttr(node, 'cards', { required: true })

    if (!Array.isArray(rawCards) || !rawCards.every(isRawCard)) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message:
          'Prop "cards" must be an array of { heading, amount, benefits, ctaText, ctaLink } objects, each optionally with summary, seats, benefitsLabel, ctaExternal and ctaDocument.',
        component: 'DonationCards',
        prop: 'cards',
        ...position
      })
    }

    if (rawCards.length < MIN_CARDS) {
      throw new MdxParserError({
        code: ParserErrorCode.INVALID_PROP_VALUE,
        message: `Prop "cards" requires at least ${MIN_CARDS} card.`,
        component: 'DonationCards',
        prop: 'cards',
        ...position
      })
    }

    const block: DonationCardsBlock = {
      __component: 'blocks.donation-cards',
      ariaLabel,
      cards: rawCards.map((card) => {
        const summary = card.summary?.trim()
        const seats = card.seats?.trim()
        const benefitsLabel = card.benefitsLabel?.trim()
        return {
          heading: card.heading.trim(),
          amount: card.amount.trim(),
          ...(summary ? { summary } : {}),
          ...(seats ? { seats } : {}),
          ...(benefitsLabel ? { benefitsLabel } : {}),
          benefits: card.benefits.trim(),
          ctaText: card.ctaText.trim(),
          ctaLink: card.ctaLink.trim(),
          ...(card.ctaExternal ? { ctaExternal: true } : {}),
          ...(card.ctaDocument ? { ctaDocument: true } : {})
        }
      })
    }

    return [block]
  })
}

registerComponentHandler('DonationCards', handleDonationCards)
