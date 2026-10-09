/**
 * Shared class strings for the filter/select dropdown used by the blog
 * language filter, grantee year filter, and contact topic listbox.
 *
 * Every Tailwind class is a literal so the v4 content scanner can see them.
 * Callers add extras (font-thin, a right-edge `right-0 left-auto`) through
 * twMerge via the `summaryClass` / `panelClass` props.
 */

export const FILTER_DROPDOWN_SUMMARY_CLASS = [
  'list-none flex gap-md items-center cursor-pointer',
  'p-xs rounded-lg border border-transparent',
  'group-open:text-neutral-100 group-open:[&_svg]:-rotate-90',
  '[&_svg]:transition-all motion-safe:[&_svg]:duration-500 [&_svg]:ease-in-out',
  'focus-visible:outline-none focus-visible:border focus-visible:border-primary'
].join(' ')

export const FILTER_DROPDOWN_PANEL_CLASS = [
  'list-none m-0 p-sm [&_li]:m-0 w-max',
  'absolute left-0 top-[calc(var(--spacing-xl)+var(--spacing-xs))] z-1',
  'bg-neutral-0 rounded-xl border border-neutral-25'
].join(' ')

export const FILTER_DROPDOWN_OPTION_CLASS = [
  'group flex gap-md items-center w-full px-sm py-xs',
  'rounded-lg border border-transparent bg-transparent text-left cursor-pointer no-underline',
  'text-body-sm-standard text-neutral-75 whitespace-nowrap',
  'hover:bg-neutral-25 hover:text-neutral-100',
  'focus-visible:outline-none focus-visible:border focus-visible:border-link'
].join(' ')

export const FILTER_DROPDOWN_CHECK_CLASS =
  'hidden size-2.5 group-aria-[current=page]:block group-aria-selected:block'
