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
  const paths = await Promise.all(
    YEARS.map(async (year) => {
      const speakersForYear = await getSpeakers(year)
      return paginate(speakersForYear, {
        params: { year },
        pageSize: 20
      })
    })
  )
  return paths.flat()
}

export async function getSpeakerPages() {
  const paths = await Promise.all(
    YEARS.map(async (year) => {
      const speakersForYear = await getSpeakers(year)
      return speakersForYear.map((entry) => ({
        params: { year, id: generateSlug(entry.name) },
        props: { entry }
      }))
    })
  )
  return paths.flat()
}

export async function getSessionPages() {
  return YEARS.flatMap((year) => {
    const talksForYear = getTalks(year)
    return talksForYear.map((entry) => ({
      params: { year, id: generateSlug(entry.title) },
      props: { entry }
    }))
  })
}
