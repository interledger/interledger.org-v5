import type { PaginateFunction } from 'astro'
import { z } from 'zod'
import type { GranteeProfile } from '@/types/airtable'
import { foldSearchText } from '../shared/foldSearchText'
import { isRecordId } from './airtableFieldValues'
import { SLUG_PATTERN } from './airtableProfiles'
import {
  compareByStartMonth,
  normalizeCountry,
  parseGranteeRecords,
  type GranteeProject
} from './grantee'
import { filterGrantees } from './granteeFilters'
import {
  buildGrantReportLinks,
  parseLegacyGrantReports,
  type GrantReportLink
} from './grantReportLinks'
import { grantReportLabel, parseGrantReports } from './grantReports'
import { useTranslations, type Locale, type Translate } from './i18'
import { localizeRoute } from './routes'
import { generateSlug } from './slug'

// The grantee directory: one card per grantee (an organisation or a person),
// listing its published projects, each with links to its reports. Each
// report links its page on this site, or else its older report, mostly on the
// community forum. Both carry a type and a number, so the card says "Interim
// report 1". Projects come from grantee-data.json, grantees from
// grantee-profiles.json, report pages from grant-reports.json and older
// reports from legacy-grant-reports.json. A grantee with no published project
// is left out.

export const GRANTEE_PAGE_SIZE = 10

/** A link from a project to one of its reports. */
export interface GranteeReportLink {
  id: string
  /**
   * "Interim report 1". A Project Links fallback has no type, so one link is
   * "Report" and several are "Report 1", "Report 2".
   */
  label: string
  href: string
  /** An older report on another site. A page on this site leaves it unset. */
  external?: boolean
}

export interface GranteeDirectoryProject extends GranteeProject {
  /**
   * Report pages, or the project's forum links when it has no page. Empty
   * shows "No reports published yet".
   */
  reports: GranteeReportLink[]
}

export interface GranteeDirectoryEntry {
  id: string
  slug: string
  name: string
  country: string
  /** The newest project's start month, as YYYY-MM. */
  startMonth: string
  startLabel: string
  /** Every tag of every project, once each, in project order. */
  tags: string[]
  /** Newest first. Never empty. */
  projects: GranteeDirectoryProject[]
  searchText: string
}

/** The four Airtable files, as imported. */
export interface GranteeDirectorySources {
  projects: unknown
  profiles: unknown
  reports: unknown
  legacyReports: unknown
}

export interface GranteeFilterOption {
  value: string
  label: string
}

type DirectoryProfile = Pick<
  GranteeProfile,
  'id' | 'name' | 'slug' | 'country' | 'grantIds'
>

const directoryProfileSchema = z.object({
  id: z.string().refine(isRecordId, 'expected an Airtable record ID'),
  name: z.string().trim().min(1),
  slug: z.string().regex(SLUG_PATTERN),
  country: z.string().nullable(),
  grantIds: z.array(z.string())
}) satisfies z.ZodType<DirectoryProfile>

// The sync validates every profile before it writes the file, so a failure
// here means a hand edit or a shape change the site has not caught up with.
function parseDirectoryProfiles(data: unknown): DirectoryProfile[] | Error {
  const result = z.array(directoryProfileSchema).safeParse(data)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  return new Error(
    `grantee-profiles.json does not match the profile shape at ${issue?.path.join('.') ?? '(root)'}: ${issue?.message ?? 'unknown error'}`
  )
}

type ReportLinksByGrant = ReadonlyMap<string, GrantReportLink[]>

// A report whose project is not in the directory has a page but no link.
// Programs agreed it should go live anyway (INTORG-1373), because comms can
// share its address directly.
function reportLinksByGrant(
  sources: GranteeDirectorySources
): ReportLinksByGrant | Error {
  const legacyReports = parseLegacyGrantReports(sources.legacyReports)
  if (legacyReports instanceof Error) return legacyReports
  const reports = parseGrantReports(sources.reports)
  if (reports instanceof Error) return reports
  return buildGrantReportLinks({ reports, legacyReports })
}

function toGranteeReportLink(
  link: GrantReportLink,
  locale: Locale,
  t: Translate
): GranteeReportLink {
  const label = grantReportLabel(link, t)
  if (link.kind === 'page') {
    const href = localizeRoute(link.path, locale)
    return { id: href, label, href }
  }
  return { id: link.url, label, href: link.url, external: true }
}

// Project Links say nothing about the report type. They are the fallback for
// a grant with no row in Submitted Reports: one link is "Report", several are
// numbered in the order the data lists them.
function projectLinkFallback(
  project: GranteeProject,
  t: Translate
): GranteeReportLink[] {
  const single = project.reportUrls.length === 1
  return project.reportUrls.map((url, index) => ({
    id: url,
    label: single
      ? t('grantee.reports.one')
      : t('grantee.reports.numbered', { number: index + 1 }),
    href: url,
    external: true
  }))
}

function reportsForProject(
  project: GranteeProject,
  links: ReportLinksByGrant,
  locale: Locale,
  t: Translate
): GranteeReportLink[] {
  const typed = links.get(project.id) ?? []
  if (typed.length > 0) {
    return typed.map((link) => toGranteeReportLink(link, locale, t))
  }
  return projectLinkFallback(project, t)
}

// A project nobody owns would drop out of the directory without a word, so
// it fails the build. The JSON only changes in the sync's pull request,
// whose build catches it before it reaches staging.
function findUnownedProjects(
  projects: GranteeProject[],
  profiles: DirectoryProfile[]
): GranteeProject[] {
  const owned = new Set(profiles.flatMap((profile) => profile.grantIds))
  return projects.filter((project) => !owned.has(project.id))
}

function uniqueTags(projects: GranteeProject[]): string[] {
  return [...new Set(projects.flatMap((project) => project.tags))]
}

function toDirectoryEntry(
  profile: DirectoryProfile,
  projects: GranteeDirectoryProject[]
): GranteeDirectoryEntry {
  const [newest] = projects
  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name.trim(),
    country: normalizeCountry(profile.country ?? '') || newest.country,
    startMonth: newest.startMonth,
    startLabel: newest.startLabel,
    tags: uniqueTags(projects),
    projects,
    searchText: foldSearchText(
      [profile.name, ...projects.map((project) => project.searchText)].join(' ')
    )
  }
}

/**
 * Group the published projects under their grantees, newest first. A
 * project owned by two grantees (a joint grant) is listed under both.
 */
export function buildGranteeDirectory(
  sources: GranteeDirectorySources,
  locale: Locale
): GranteeDirectoryEntry[] | Error {
  const projects = parseGranteeRecords(sources.projects, locale)
  if (projects instanceof Error) return projects
  const profiles = parseDirectoryProfiles(sources.profiles)
  if (profiles instanceof Error) return profiles
  const links = reportLinksByGrant(sources)
  if (links instanceof Error) return links
  const t = useTranslations(locale)

  const unowned = findUnownedProjects(projects, profiles)
  if (unowned.length > 0) {
    const names = unowned.map((project) => `${project.name} (${project.id})`)
    return new Error(
      `Published projects with no grantee in grantee-profiles.json: ${names.join(', ')}`
    )
  }

  const projectsById = new Map(projects.map((project) => [project.id, project]))
  return profiles
    .flatMap((profile) => {
      const ownProjects = profile.grantIds
        .flatMap((id) => projectsById.get(id) ?? [])
        .sort(compareByStartMonth)
        .map((project) => ({
          ...project,
          reports: reportsForProject(project, links, locale, t)
        }))
      return ownProjects.length > 0
        ? [toDirectoryEntry(profile, ownProjects)]
        : []
    })
    .sort(compareByStartMonth)
}

export function uniqueFilterOptions(
  grantees: GranteeDirectoryEntry[],
  key: 'year' | 'tag'
): GranteeFilterOption[] {
  const seen = new Map<string, string>()
  const projects = grantees.flatMap((grantee) => grantee.projects)

  for (const project of projects) {
    if (key === 'year' && project.year) {
      seen.set(project.year, project.year)
    } else if (key === 'tag') {
      for (const tag of project.tags) {
        const slug = generateSlug(tag)
        if (slug) seen.set(slug, tag)
      }
    }
  }

  const options = [...seen.entries()].map(([value, label]) => ({
    value,
    label
  }))

  if (key === 'year') {
    return options.sort((a, b) => b.label.localeCompare(a.label))
  }
  return options.sort((a, b) => a.label.localeCompare(b.label))
}

export interface GranteeListingData {
  grantees: GranteeDirectoryEntry[]
  years: GranteeFilterOption[]
  tags: GranteeFilterOption[]
}

export function getGranteeListingData(
  sources: GranteeDirectorySources,
  locale: Locale
): GranteeListingData | Error {
  const grantees = buildGranteeDirectory(sources, locale)
  if (grantees instanceof Error) return grantees
  return {
    grantees,
    years: uniqueFilterOptions(grantees, 'year'),
    tags: uniqueFilterOptions(grantees, 'tag')
  }
}

/** One project as the client-side search catalog ships it. */
export interface GranteeSearchProject {
  id: string
  name: string
  program: string
  year: string
  tags: string[]
  budgetLabel: string | null
  reports: GranteeReportLink[]
}

/**
 * A grantee as shipped in the client-side search catalog (see
 * `grantee-search-index.json.ts` and `src/scripts/grantee-search.ts`):
 * what a search-result card needs and nothing more.
 */
export interface GranteeSearchEntry {
  id: string
  name: string
  country: string
  startMonth: string
  startLabel: string
  tags: string[]
  projects: GranteeSearchProject[]
  searchText: string
}

function toSearchProject(
  project: GranteeDirectoryProject
): GranteeSearchProject {
  return {
    id: project.id,
    name: project.name,
    program: project.program,
    year: project.year,
    tags: project.tags,
    budgetLabel: project.budgetLabel,
    reports: project.reports
  }
}

function toGranteeSearchEntry(
  grantee: GranteeDirectoryEntry
): GranteeSearchEntry {
  return {
    id: grantee.id,
    name: grantee.name,
    country: grantee.country,
    startMonth: grantee.startMonth,
    startLabel: grantee.startLabel,
    tags: grantee.tags,
    projects: grantee.projects.map(toSearchProject),
    searchText: grantee.searchText
  }
}

/**
 * Build-time catalog for client-side grantee search. Small and locale-scoped
 * so it can be fetched once (lazily, on first search interaction) and reused
 * across every paginated/filtered directory route — see
 * `src/pages/grantee-search-index.json.ts`.
 */
export function getGranteeSearchIndex(
  sources: GranteeDirectorySources,
  locale: Locale
): GranteeSearchEntry[] | Error {
  const grantees = buildGranteeDirectory(sources, locale)
  if (grantees instanceof Error) return grantees
  return grantees.map(toGranteeSearchEntry)
}

/** Filter options and active selections passed through paginate `props`. */
// A type, not an interface: paginate's props need an index signature.
type GranteeListingPageProps = {
  years: GranteeFilterOption[]
  tags: GranteeFilterOption[]
  selectedYear?: string
  selectedTag?: string
}

type ListingPaginationArgs = {
  paginate: PaginateFunction
  grantees: GranteeDirectoryEntry[]
  years: GranteeFilterOption[]
  tags: GranteeFilterOption[]
}

function paginateFiltered(
  { paginate, grantees, years, tags }: ListingPaginationArgs,
  selected: { year?: string; tag?: string }
) {
  const entries = filterGrantees(grantees, {
    q: '',
    year: selected.year ?? '',
    tag: selected.tag ?? ''
  })
  const props: GranteeListingPageProps = {
    years,
    tags,
    selectedYear: selected.year,
    selectedTag: selected.tag
  }
  return paginate(entries, {
    params: selected,
    pageSize: GRANTEE_PAGE_SIZE,
    props
  })
}

/** Year listings at `/grantee-directory/<year>`. */
export function paginateGranteesByYear(args: ListingPaginationArgs) {
  return args.years.flatMap((year) =>
    paginateFiltered(args, { year: year.value })
  )
}

/** Tag listings at `/grantee-directory/tag/<slug>`. */
export function paginateGranteesByTag(args: ListingPaginationArgs) {
  return args.tags.flatMap((tag) => paginateFiltered(args, { tag: tag.value }))
}

/** Year + tag listings at `/grantee-directory/<year>/tag/<slug>`. */
export function paginateGranteesByYearAndTag(args: ListingPaginationArgs) {
  return args.years.flatMap((year) =>
    args.tags.flatMap((tag) =>
      paginateFiltered(args, { year: year.value, tag: tag.value })
    )
  )
}
