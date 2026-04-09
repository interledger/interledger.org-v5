import type { PaginateFunction } from 'astro'
import { getSpeakers, getTalks, getTalkPreviews } from './extractSessionize'
import { generateSlug } from './slug'
import { YEARS } from './sessionize'
import {
  type SessionizeSupportedLocale,
  SESSIONIZE_SUPPORTED_LOCALES
} from '@/types/summit'

function isSessionizeSupportedLocale(
  lang: string
): lang is SessionizeSupportedLocale {
  return (SESSIONIZE_SUPPORTED_LOCALES as readonly string[]).includes(lang)
}

export function getTranslation<
  T extends Record<SessionizeSupportedLocale, unknown>
>(entry: T, lang: string): T[SessionizeSupportedLocale] | null {
  return isSessionizeSupportedLocale(lang) ? entry[lang] : null
}

export async function paginateSummitTalks(paginate: PaginateFunction) {
  const paths = await Promise.all(
    YEARS.map(async (year) => {
      const talksForYear = await getTalkPreviews(year)
      return paginate(talksForYear, {
        params: { year },
        pageSize: 10
      })
    })
  )
  return paths.flat()
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
  const paths = await Promise.all(
    YEARS.map(async (year) => {
      const talksForYear = await getTalks(year)
      return talksForYear.map((entry) => ({
        params: { year, id: generateSlug(entry.title) },
        props: { entry }
      }))
    })
  )
  return paths.flat()
}
