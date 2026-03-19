import type { PaginateFunction } from 'astro'
import { getSpeakers, getTalks } from './extractSessionize'
import { generateSlug } from './slug'

export const YEARS = ['2022', '2023', '2024', '2025'].sort()
export const currentYear = YEARS.at(-1)

export async function paginateSummitTalks(paginate: PaginateFunction) {
  return YEARS.flatMap((year) => {
    const talksForYear = getTalks(year)
    return paginate(talksForYear, {
      params: { year },
      pageSize: 10
    })
  })
}

export async function paginateSummitSpeakers(paginate: PaginateFunction) {
  return YEARS.flatMap((year) => {
    const speakersForYear = getSpeakers(year)
    return paginate(speakersForYear, {
      params: { year },
      pageSize: 20
    })
  })
}

export async function getSpeakerPages() {
  return YEARS.flatMap((year) => {
    const speakersForYear = getSpeakers(year)
    return speakersForYear.map((entry) => ({
      params: { year: year, id: generateSlug(entry.name) },
      props: { entry }
    }))
  })
}

export async function getSessionPages() {
  return YEARS.flatMap((year) => {
    const talksForYear = getTalks(year)
    return talksForYear.map((entry) => ({
      params: { year: year, id: generateSlug(entry.title) },
      props: { entry }
    }))
  })
}
