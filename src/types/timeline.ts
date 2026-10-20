/**
 * Timeline block (INTORG-930): dated events grouped into sections whose
 * heading, subheading and description stay on screen while the reader scrolls
 * through them. Mirrors `blocks.timeline` in Strapi; the CMS side keeps its
 * own copy in `cms/src/utils/timeline.ts`.
 */

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
