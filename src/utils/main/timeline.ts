import type { TimelineEvent, TimelineSection } from '@/types/timeline'

/**
 * Dot colours, in cycle order. Written out in full so Tailwind can see them.
 * The first event on a timeline is black and is not in this list.
 */
export const TIMELINE_DOT_CLASS = [
  'bg-orchid-100',
  'bg-lagoon-100',
  'bg-emerald-100',
  'bg-coral-red-100',
  'bg-deep-teal-100',
  'bg-tangerine-100',
  'bg-raspberry-100',
  'bg-soft-indigo-100',
  'bg-forest-green-100',
  'bg-apricot-100',
  'bg-flamingo-100',
  'bg-lavender-100',
  'bg-aqua-mint-100',
  'bg-pistachio-100',
  'bg-blush-100'
] as const

export const TIMELINE_ACCENT_COUNT = TIMELINE_DOT_CLASS.length

/** Which accent an event dot takes, so the sequence restarts after the last one. */
export function timelineAccentIndex(eventIndex: number): number {
  if (!Number.isInteger(eventIndex) || eventIndex < 0) return 0
  return eventIndex % TIMELINE_ACCENT_COUNT
}

/**
 * The timeline-wide position of each section's first event, so dot colours
 * keep cycling across section boundaries instead of restarting per section.
 */
export function timelineEventOffsets(sections: TimelineSection[]): number[] {
  let next = 0
  return sections.map((section) => {
    const offset = next
    next += section.events.length
    return offset
  })
}

function filled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function resolveEvent(event: unknown): TimelineEvent | null {
  if (typeof event !== 'object' || event === null) return null
  const { date, description, tag } = event as Record<string, unknown>
  if (!filled(date) || !filled(description) || !filled(tag)) return null
  return { date: date.trim(), description: description.trim(), tag: tag.trim() }
}

function resolveSection(section: unknown): TimelineSection | null {
  if (typeof section !== 'object' || section === null) return null
  const { heading, subheading, description, events } = section as Record<
    string,
    unknown
  >
  if (!filled(heading) || !filled(subheading) || !filled(description)) {
    return null
  }

  const resolvedEvents = Array.isArray(events)
    ? events.map(resolveEvent).filter((event) => event !== null)
    : []
  if (resolvedEvents.length === 0) return null

  return {
    heading: heading.trim(),
    subheading: subheading.trim(),
    description: description.trim(),
    events: resolvedEvents
  }
}

/**
 * Sections the Timeline can render. Exported MDX is already validated, but the
 * Strapi preview spreads a draft as saved, where required fields are still
 * missing while an editor types. An incomplete event or section is skipped
 * rather than throwing and blanking the whole preview.
 */
export function resolveTimelineSections(sections: unknown): TimelineSection[] {
  if (!Array.isArray(sections)) return []
  return sections.map(resolveSection).filter((section) => section !== null)
}
