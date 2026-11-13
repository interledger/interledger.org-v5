/**
 * Shared definitions for the Timeline block (INTORG-930).
 *
 * Strapi's `required`/`min` constraints on nested repeatable components are
 * not enforced at save time, so both write paths validate here: the MDX
 * parser on import and the serializer on admin save and export. Both import
 * from this module so the two cannot drift.
 *
 * Kept free of Strapi imports (type-only `FieldError`) so the sync script can
 * load it the way it loads `cardGrid` and `ctaButtons`.
 */

import type { FieldError } from './contentValidation'

/**
 * Every failing field in a timeline, with paths relative to the block. The
 * serializer rewraps it as a `SerializerFieldError` for the admin UI; the MDX
 * parser folds the messages into one `MdxParserError`.
 */
export class TimelineFieldError extends Error {
  fieldErrors: FieldError[]

  constructor(fieldErrors: FieldError[]) {
    super(fieldErrors.map((error) => error.message).join('; '))
    this.name = 'TimelineFieldError'
    this.fieldErrors = fieldErrors
  }
}

export interface TimelineEvent {
  /** Free text, not a machine date: "Oct 2015", "2015-2017", "today". */
  date: string
  description: string
  /** One or two words, e.g. "Standards / Protocol". */
  tag: string
}

export interface TimelineSection {
  heading: string
  subheading: string
  description: string
  events: TimelineEvent[]
}

export const MIN_TIMELINE_SECTIONS = 1
export const MIN_TIMELINE_EVENTS = 1

const SECTION_TEXT_FIELDS = ['heading', 'subheading', 'description'] as const
const EVENT_TEXT_FIELDS = ['date', 'description', 'tag'] as const

type SectionTextField = (typeof SECTION_TEXT_FIELDS)[number]
type EventTextField = (typeof EVENT_TEXT_FIELDS)[number]

const FIELD_NOUNS: Record<SectionTextField | EventTextField, string> = {
  heading: 'its heading',
  subheading: 'its subheading',
  description: 'a description',
  date: 'a date',
  tag: 'a tag'
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function missingTextErrors(
  record: Record<string, unknown>,
  fields: readonly (SectionTextField | EventTextField)[],
  path: FieldError['path'],
  subject: string
): FieldError[] {
  return fields
    .filter((field) => !hasText(record[field]))
    .map((field) => ({
      message: `${subject} is missing ${FIELD_NOUNS[field]}`,
      path: [...path, field]
    }))
}

function validateEvent(
  event: unknown,
  sectionIndex: number,
  eventIndex: number
): FieldError[] {
  const path = ['sections', sectionIndex, 'events', eventIndex]
  const subject = `Section ${sectionIndex + 1}, event ${eventIndex + 1}`
  const record = asRecord(event)
  if (!record) return [{ message: `${subject} is not an event`, path }]
  return missingTextErrors(record, EVENT_TEXT_FIELDS, path, subject)
}

function validateSection(section: unknown, index: number): FieldError[] {
  const path = ['sections', index]
  const subject = `Section ${index + 1}`
  const record = asRecord(section)
  if (!record) return [{ message: `${subject} is not a section`, path }]

  const textErrors = missingTextErrors(
    record,
    SECTION_TEXT_FIELDS,
    path,
    subject
  )

  if (
    !Array.isArray(record.events) ||
    record.events.length < MIN_TIMELINE_EVENTS
  ) {
    return [
      ...textErrors,
      {
        message: `${subject} requires at least ${MIN_TIMELINE_EVENTS} event`,
        path: [...path, 'events']
      }
    ]
  }

  return [
    ...textErrors,
    ...record.events.flatMap((event, eventIndex) =>
      validateEvent(event, index, eventIndex)
    )
  ]
}

/**
 * Every failing field across the whole block, so an editor fixes everything in
 * one pass. Paths are relative to the block (`['sections', i, 'events', j, …]`)
 * so the admin UI can highlight the field.
 */
export function validateTimelineSections(raw: unknown): FieldError[] {
  if (!Array.isArray(raw) || raw.length < MIN_TIMELINE_SECTIONS) {
    return [
      {
        message: `Timeline block requires at least ${MIN_TIMELINE_SECTIONS} section`,
        path: ['sections']
      }
    ]
  }
  return raw.flatMap(validateSection)
}

/**
 * Validate and trim the `sections` field of a Timeline block. Accepts the
 * loosely typed shapes both write paths produce — Strapi's save body and the
 * MDX parser's static literal — and returns clean sections or every failing
 * field at once.
 */
export function normalizeTimelineSections(
  raw: unknown
): TimelineSection[] | TimelineFieldError {
  const fieldErrors = validateTimelineSections(raw)
  if (fieldErrors.length > 0) return new TimelineFieldError(fieldErrors)

  // Validation guarantees the shape from here on.
  const sections = raw as Array<
    Record<SectionTextField, string> & {
      events: Array<Record<EventTextField, string>>
    }
  >

  return sections.map((section) => ({
    heading: section.heading.trim(),
    subheading: section.subheading.trim(),
    description: section.description.trim(),
    events: section.events.map((event) => ({
      date: event.date.trim(),
      description: event.description.trim(),
      tag: event.tag.trim()
    }))
  }))
}
