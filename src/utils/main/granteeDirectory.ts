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
  compareGrantReports,
  grantReportLabel,
  grantReportPath,
  parseGrantReports
} from './grantReports'
import { useTranslations, type Locale, type Translate } from './i18'
import { localizeRoute } from './routes'
import { generateSlug } from './slug'

// The grantee directory: one card per grantee (an organisation or a person),
// listing its published projects, each with links to its reports. A report
// page wins; otherwise the card links the project's Project Links, which are
// the forum reports. Projects come from grantee-data.json, grantees from
// grantee-profiles.json and report pages from grant-reports.json. A grantee
// with no published project is left out.

export const GRANTEE_PAGE_SIZE = 10

/** A link from a project to one of its reports. */
export interface GranteeReportLink {
  id: string
  /** "Interim report 1" for a page, or the same shape read from a forum URL. */
  label: string
  href: string
  /** A forum report. A page on this site leaves it unset. */
  external?: boolean
}

export interface GranteeDirectoryProject extends GranteeProject {
  /**
   * Report pages, or the project's forum links when it has no page.
   * Null while the report pages are hidden and the project has no forum
   * link, so the card shows nothing rather than "No reports published yet".
   */
  reports: GranteeReportLink[] | null
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

/** The three Airtable files, as imported, plus the report feature gate. */
export interface GranteeDirectorySources {
  projects: unknown
  profiles: unknown
  reports: unknown
  showReports: boolean
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

type ReportLinksByProject = Map<string, GranteeReportLink[]>

// "report-1-final" is report 1. "final-report-379a" is not: the digits are
// the forum post id glued to the slug.
const FORUM_REPORT_NUMBER = /report-(\d+)(?![a-z0-9])/i

// A report whose project is not in the directory has a page but no link.
// Programs agreed it should go live anyway (INTORG-1373), because comms can
// share its address directly.
function pageLinksByProject(
  sources: GranteeDirectorySources,
  locale: Locale
): ReportLinksByProject | null | Error {
  if (!sources.showReports) return null
  const reports = parseGrantReports(sources.reports)
  if (reports instanceof Error) return reports

  const t = useTranslations(locale)
  const links: ReportLinksByProject = new Map()
  for (const report of [...reports].sort(compareGrantReports)) {
    const projectLinks = links.get(report.grantId) ?? []
    projectLinks.push({
      id: report.id,
      label: grantReportLabel(report, t),
      href: localizeRoute(grantReportPath(report), locale)
    })
    links.set(report.grantId, projectLinks)
  }
  return links
}

// Forum slugs are not a schema. "grant-report-1-final" becomes "Final report
// 1"; a slug with neither a number nor "final"/"interim" stays "Report".
function forumReportLabel(url: string, t: Translate): string {
  let path = url
  try {
    path = decodeURIComponent(new URL(url).pathname)
  } catch {
    path = url
  }
  const number = FORUM_REPORT_NUMBER.exec(path)?.[1]
  const type = /\bfinal\b/i.test(path)
    ? t('grantReport.type.final')
    : /\binterim\b/i.test(path)
      ? t('grantReport.type.interim')
      : null
  if (type && number) {
    return t('grantReport.label', { type, number })
  }
  if (type) return type
  if (number) return t('grantee.reports.numbered', { number })
  return t('grantee.reports.link')
}

function forumReportLinks(
  project: GranteeProject,
  t: Translate
): GranteeReportLink[] {
  return project.reportUrls.map((url) => ({
    id: url,
    label: forumReportLabel(url, t),
    href: url,
    external: true
  }))
}

function reportsForProject(
  project: GranteeProject,
  pageLinks: ReportLinksByProject | null,
  t: Translate
): GranteeReportLink[] | null {
  const pages = pageLinks?.get(project.id) ?? []
  if (pages.length > 0) return pages
  const forum = forumReportLinks(project, t)
  if (forum.length > 0) return forum
  return pageLinks ? [] : null
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
  const pageLinks = pageLinksByProject(sources, locale)
  if (pageLinks instanceof Error) return pageLinks
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
          reports: reportsForProject(project, pageLinks, t)
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
  reports: GranteeReportLink[] | null
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
