import type { PaginateFunction } from 'astro'
import { getSpeakers, getTalks } from './extractSessionize'
import { generateSlug } from './slug'
import { YEARS } from './sessionize'

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
