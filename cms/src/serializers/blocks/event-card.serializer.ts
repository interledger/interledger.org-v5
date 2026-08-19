import { escDouble as esc, escMdxBraces } from '../shared'
import {
  SerializerFieldError,
  hasConflictingCtaFlags,
  type FieldError
} from '../../utils'

interface EventCardWhen {
  title?: string
  text?: string
  date?: string
  time?: string
}

interface EventCardWhere {
  title?: string
  text?: string
  location?: string
}

interface EventCardApply {
  title?: string
  text?: string
  primaryCta?: {
    text?: string
    link?: string
    external?: boolean
    document?: boolean
  }
}

function validateEventWhen(when: EventCardWhen | undefined): FieldError[] {
  if (!when) {
    return [
      {
        message: 'Event card is missing the When column',
        path: ['when']
      }
    ]
  }
  if (!when.title?.trim()) {
    return [
      {
        message: 'Event card When column is missing a title',
        path: ['when', 'title']
      }
    ]
  }
  return []
}

function validateEventWhere(where: EventCardWhere | undefined): FieldError[] {
  if (!where) {
    return [
      {
        message: 'Event card is missing the Where column',
        path: ['where']
      }
    ]
  }
  if (!where.title?.trim()) {
    return [
      {
        message: 'Event card Where column is missing a title',
        path: ['where', 'title']
      }
    ]
  }
  return []
}

/**
 * Apply is optional; when present its title and primary CTA text/link are
 * required. Returns every failing field so editors can fix them in one pass.
 */
function validateEventApply(
  apply: EventCardApply | null | undefined
): FieldError[] {
  if (!apply) return []

  const fieldErrors: FieldError[] = []

  if (!apply.primaryCta) {
    fieldErrors.push({
      message: 'Event card Apply column is missing a primary call to action',
      path: ['apply', 'primaryCta']
    })
    return fieldErrors
  }

  if (!apply.primaryCta.text?.trim()) {
    fieldErrors.push({
      message: 'Event card Apply button is missing link text',
      path: ['apply', 'primaryCta', 'text']
    })
  }
  if (!apply.primaryCta.link?.trim()) {
    fieldErrors.push({
      message: 'Event card Apply button is missing a URL',
      path: ['apply', 'primaryCta', 'link']
    })
  }
  if (
    hasConflictingCtaFlags({
      external: Boolean(apply.primaryCta.external),
      document: Boolean(apply.primaryCta.document)
    })
  ) {
    fieldErrors.push({
      message:
        'Event card Apply button cannot be both External Link and Document Download',
      path: ['apply', 'primaryCta', 'document']
    })
  }

  return fieldErrors
}

/** Aggregate When / Where / Apply errors (same shape as validateFaq). */
function validateEventCard(block: {
  when?: EventCardWhen
  where?: EventCardWhere
  apply?: EventCardApply | null
}): FieldError[] {
  return [
    ...validateEventWhen(block.when),
    ...validateEventWhere(block.where),
    ...validateEventApply(block.apply)
  ]
}

function serializeOptionalTextBody(text: string | undefined): string {
  const trimmed = text?.trim()
  if (!trimmed) return ''
  return `\n\n${escMdxBraces(trimmed)}\n\n`
}

function serializeWhen(when: EventCardWhen): string {
  const attrs = [`title="${esc(when.title!.trim())}"`]
  if (when.date?.trim()) attrs.push(`date="${esc(when.date.trim())}"`)
  if (when.time?.trim()) attrs.push(`time="${esc(when.time.trim())}"`)
  const body = serializeOptionalTextBody(when.text)
  if (!body) return `<EventWhen ${attrs.join(' ')} />`
  return `<EventWhen ${attrs.join(' ')}>${body}</EventWhen>`
}

function serializeWhere(where: EventCardWhere): string {
  const attrs = [`title="${esc(where.title!.trim())}"`]
  if (where.location?.trim())
    attrs.push(`location="${esc(where.location.trim())}"`)
  const body = serializeOptionalTextBody(where.text)
  if (!body) return `<EventWhere ${attrs.join(' ')} />`
  return `<EventWhere ${attrs.join(' ')}>${body}</EventWhere>`
}

function serializeApply(apply: EventCardApply): string {
  const cta = apply.primaryCta!
  const attrs = [
    `buttonText="${esc(cta.text!.trim())}"`,
    `buttonUrl="${esc(cta.link!.trim())}"`
  ]
  if (apply.title?.trim()) attrs.unshift(`title="${esc(apply.title.trim())}"`)
  if (cta.external) attrs.push('buttonExternal={true}')
  if (cta.document) attrs.push('buttonDocument={true}')
  const body = serializeOptionalTextBody(apply.text)
  if (!body) return `<EventApply ${attrs.join(' ')} />`
  return `<EventApply ${attrs.join(' ')}>${body}</EventApply>`
}

export function serialize(block: {
  title?: string
  when?: EventCardWhen
  where?: EventCardWhere
  apply?: EventCardApply | null
}): string {
  const fieldErrors = validateEventCard(block)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  const open = block.title?.trim()
    ? `<EventCard title="${esc(block.title.trim())}">`
    : '<EventCard>'

  const parts = [serializeWhen(block.when!), serializeWhere(block.where!)]
  if (block.apply) parts.push(serializeApply(block.apply))

  return `${open}\n\n${parts.join('\n\n')}\n\n</EventCard>`
}
