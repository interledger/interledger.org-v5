import { escDouble as esc, escMdxBraces } from '../shared'
import { SerializerFieldError, type FieldError } from '../../utils'

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
  }
}

/**
 * Validate the whole event card. Returns every failing field so an editor can
 * fix everything in one pass. Apply is optional; when present its title and
 * primary CTA text/link are required.
 */
function validateEventCard(block: {
  when?: EventCardWhen
  where?: EventCardWhere
  apply?: EventCardApply | null
}): FieldError[] {
  const fieldErrors: FieldError[] = []

  if (!block.when) {
    fieldErrors.push({
      message: 'Event card is missing the When column',
      path: ['when']
    })
  } else if (!block.when.title?.trim()) {
    fieldErrors.push({
      message: 'Event card When column is missing a title',
      path: ['when', 'title']
    })
  }

  if (!block.where) {
    fieldErrors.push({
      message: 'Event card is missing the Where column',
      path: ['where']
    })
  } else if (!block.where.title?.trim()) {
    fieldErrors.push({
      message: 'Event card Where column is missing a title',
      path: ['where', 'title']
    })
  }

  // Apply is optional; only validate when editors filled any part of it.
  if (block.apply) {
    if (!block.apply.title?.trim()) {
      fieldErrors.push({
        message: 'Event card Apply column is missing a title',
        path: ['apply', 'title']
      })
    }

    if (!block.apply.primaryCta) {
      fieldErrors.push({
        message: 'Event card Apply column is missing a primary call to action',
        path: ['apply', 'primaryCta']
      })
    } else {
      if (!block.apply.primaryCta.text?.trim()) {
        fieldErrors.push({
          message: 'Event card Apply button is missing link text',
          path: ['apply', 'primaryCta', 'text']
        })
      }
      if (!block.apply.primaryCta.link?.trim()) {
        fieldErrors.push({
          message: 'Event card Apply button is missing a URL',
          path: ['apply', 'primaryCta', 'link']
        })
      }
    }
  }

  return fieldErrors
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
    `title="${esc(apply.title!.trim())}"`,
    `buttonText="${esc(cta.text!.trim())}"`,
    `buttonUrl="${esc(cta.link!.trim())}"`
  ]
  if (cta.external) attrs.push('buttonExternal={true}')
  const body = serializeOptionalTextBody(apply.text)
  if (!body) return `<EventApply ${attrs.join(' ')} />`
  return `<EventApply ${attrs.join(' ')}>${body}</EventApply>`
}

export function serialize(block: {
  when?: EventCardWhen
  where?: EventCardWhere
  apply?: EventCardApply | null
}): string {
  const fieldErrors = validateEventCard(block)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  // Validation guarantees when/where (and apply fields when present).
  const parts = [serializeWhen(block.when!), serializeWhere(block.where!)]
  if (block.apply) parts.push(serializeApply(block.apply))

  return `<EventCard>\n\n${parts.join('\n\n')}\n\n</EventCard>`
}
