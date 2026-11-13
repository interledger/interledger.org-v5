import { marked } from 'marked'
import type { MarkdownHeading } from 'astro'

// Section headings are authored as markdown `##` inside <ReportSection> (see
// report-section.serializer.ts), so Astro's own heading collector picks them
// up. This is the only depth that maps to a report section's own heading.
const REPORT_SECTION_HEADING_DEPTH = 2
// Auto-generated sr-only "Footnotes" landmark (depth 2, fixed id). It is not
// an authored section, so it must be excluded from the nav.
const FOOTNOTES_HEADING_ID = 'footnote-label'

const INTRO_OPEN_TAG = '<ReportIntro>'
const INTRO_CLOSE_TAG = '</ReportIntro>'

export interface ReportNavSection {
  id: string
  heading: string
}

/**
 * True when the body opens with <ReportIntro>. generateReportMdx and
 * reportIntroHandler guarantee the intro is the leading element when present.
 */
export function hasReportIntro(body: string | undefined): boolean {
  return Boolean(body?.trim().startsWith(INTRO_OPEN_TAG))
}

function countIntroSectionHeadings(body: string | undefined): number {
  const trimmed = body?.trim() ?? ''
  if (!trimmed.startsWith(INTRO_OPEN_TAG)) return 0

  const closeIndex = trimmed.indexOf(INTRO_CLOSE_TAG)
  if (closeIndex === -1) return 0

  const introMarkdown = trimmed.slice(INTRO_OPEN_TAG.length, closeIndex)
  let count = 0
  marked.walkTokens(marked.lexer(introMarkdown), (token) => {
    if (
      token.type === 'heading' &&
      token.depth === REPORT_SECTION_HEADING_DEPTH
    )
      count++
  })
  return count
}

/**
 * The report's SectionsNav entries: every `##` heading except the footnotes
 * landmark and any `##` inside the intro. An intro heading is part of the
 * intro, not a section, so listing it would add a nav entry that points
 * above the sections and stays active while the reader is in the first one.
 *
 * Astro returns headings in document order and the intro always comes first,
 * so the intro's headings are the leading entries of the depth-2 list.
 */
export function getReportNavSections(
  body: string | undefined,
  headings: MarkdownHeading[]
): ReportNavSection[] {
  const introHeadingCount = countIntroSectionHeadings(body)

  return headings
    .filter(
      (h) =>
        h.depth === REPORT_SECTION_HEADING_DEPTH &&
        h.slug !== FOOTNOTES_HEADING_ID
    )
    .slice(introHeadingCount)
    .map((h) => ({ id: h.slug, heading: h.text }))
}
