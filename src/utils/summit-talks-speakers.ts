import type { PaginateFunction } from 'astro'
import type { Language } from '@/types/i18n'
import { getSpeakers, getTalks } from './extractSessionize'
import { generateSlug } from './slug'

export const YEARS = ['2022', '2023', '2024', '2025']

export async function paginateSummitTalks(
  paginate: PaginateFunction,
  lang: Language
) {
  return YEARS.flatMap((year) => {
    const talksForYear = getTalks(year, lang)
    return paginate(talksForYear, {
      params: { year },
      pageSize: 10
    })
  })
}

export async function paginateSummitSpeakers(
  paginate: PaginateFunction,
  lang: Language
) {
  return YEARS.flatMap((year) => {
    const speakersForYear = getSpeakers(year, lang)
    return paginate(speakersForYear, {
      params: { year },
      pageSize: 20
    })
  })
}

export async function getSpeakerPages(lang: Language) {
  return YEARS.flatMap((year) => {
    const speakersForYear = getSpeakers(year, lang)
    return speakersForYear.map((entry) => ({
      params: { year: year, id: generateSlug(entry.name) },
      props: { entry }
    }))
  })
}

export async function getSessionPages(lang: Language) {
  return YEARS.flatMap((year) => {
    const talksForYear = getTalks(year, lang)
    return talksForYear.map((entry) => ({
      params: { year: year, id: generateSlug(entry.title) },
      props: { entry }
    }))
  })
}
