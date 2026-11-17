import type { UiKey } from '@/utils/main/i18'

// Class lists that GranteeCard.astro (build time) and
// GranteeSearchResultTemplate.astro (client-side search results) share, so
// the two cards cannot drift apart. Full literal strings, so the Tailwind
// scanner sees every class.
export const granteeCardClasses = {
  card: 'm-0 rounded-3xl border border-neutral-50 bg-white p-lg tablet:p-xl',
  header:
    'flex flex-col gap-lg desktop:flex-row desktop:items-start desktop:justify-between desktop:gap-3xl',
  name: 'm-0 min-w-0 text-neutral-150',
  meta: 'flex min-w-[200px] shrink-0 flex-col gap-lg list-none m-0 p-0',
  metaItem:
    'm-0 flex items-center gap-sm text-body-sm-standard text-neutral-100 min-w-0',
  metaIcon: 'size-5 shrink-0 text-neutral-75',
  // pt-sm on top of the card's gap-lg: 24px below the header.
  tags: 'flex flex-wrap gap-xs list-none m-0 p-0 pt-sm',
  grantCount: 'm-0 text-body-sm-emphasis text-primary',
  projects: 'flex flex-col gap-sm list-none m-0 p-0',
  project:
    'm-0 flex flex-col gap-md rounded-2xl bg-ice-indigo-50 p-lg tablet:px-xl tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-xl',
  program: 'm-0 text-body-sm-standard text-primary',
  projectName:
    'm-0 text-h5 font-semibold tablet:text-h5-md desktop:text-h5-lg text-neutral-150',
  budget: 'm-0 text-body-sm-standard text-neutral-75',
  reports:
    'flex shrink-0 flex-wrap gap-sm list-none m-0 p-0 tablet:justify-end',
  noReports:
    'm-0 shrink-0 text-body-sm-standard text-neutral-75 tablet:text-right desktop:text-body-lg-standard'
} as const

/** "1 grant" or "{count} grants". */
export function granteeGrantCountKey(count: number): UiKey {
  return count === 1 ? 'grantee.grants.one' : 'grantee.grants.other'
}
