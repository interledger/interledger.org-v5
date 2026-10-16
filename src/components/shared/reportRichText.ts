/**
 * Shared class strings for rich text inside a report: the body's
 * ReportText Paragraph and the full-width ReportIntro. Both take the same
 * CKEditor markdown, so a table or a list must look the same in either.
 *
 * Every Tailwind class is a literal so the v4 content scanner can see them.
 */

export const REPORT_LIST_SPACING_CLASS = '[&_:is(ol,ul)]:mb-xl [&_li]:mb-md'

// The text size resets the table to body copy: ReportIntro's wrapper sets
// the larger intro size, which a table would otherwise inherit.
export const REPORT_TABLE_CLASS = [
  '[&_table]:w-full [&_table]:text-body-lg-standard',
  '[&_:is(th,td)]:p-md [&_th]:text-neutral-75',
  '[&_thead_th]:text-body-sm-emphasis desktop:[&_thead_th]:text-body-lg-emphasis'
].join(' ')
