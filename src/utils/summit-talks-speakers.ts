import type { PaginateFunction } from 'astro'

export interface Talk {
  id: string
  title: string
}
export interface Speaker {
  id: string
  name: string
}

export const YEARS = ['2022', '2023', '2024', '2025']

export function getSpeakers(year: string, lang: string): Speaker[] {
  const baseSpeakers: Speaker[] = [
    {
      id: '370w173',
      name: 'Ayden Férdeline'
    },
    {
      id: '38w5579',
      name: 'Ioana Chiorean'
    }
  ]
  const baseSpanishSpeakers: Speaker[] = [
    {
      id: '12342',
      name: 'Lupita'
    },
    {
      id: '020231',
      name: 'Jose Armando'
    }
  ]
  //get 22 speakers to see pagination
  const speakers2022 = Array.from({ length: 11 }).flatMap(() => baseSpeakers)
  const spanishSpeakers2022 = Array.from({ length: 5 }).flatMap(
    () => baseSpanishSpeakers
  )
  switch (true) {
    case year === '2022' && lang === 'en':
      return speakers2022
    case year === '2022' && lang === 'es':
      return spanishSpeakers2022
    default:
      console.error(
        'Year is not correct or speakers data is not available for that year'
      )
      return []
  }
}

export function getTalks(year: string, lang): Talk[] {
  const baseSessions: Talk[] = [
    {
      id: '370173',
      title: `${year} State of Interledger`
    },
    {
      id: '385579',
      title: `${year} TigerBeetle, a Financial Accounting Database for Interledger`
    }
  ]
  const baseSpanishSessions: Talk[] = [
    {
      id: '3da173',
      title: `${year} En espagnol: State of Interledger`
    },
    {
      id: '38ad79',
      title: `${year} En espagnol: TigerBeetle, a Financial Accounting Database for Interledger`
    }
  ]
  const sessions2022 = Array.from({ length: 10 }).flatMap(() => baseSessions)
  const spanishSessions2022 = Array.from({ length: 6 }).flatMap(
    () => baseSpanishSessions
  )
  const sessions2023 = Array.from({ length: 3 }).flatMap(() => baseSessions)
  switch (true) {
    case year === '2022' && lang === 'en':
      return sessions2022
    case year === '2022' && lang === 'es':
      return spanishSessions2022
    case year === '2023' && lang === 'en':
      return sessions2023
    default:
      console.error(
        'Year is not correct or sessions data is not available for that year'
      )
      return []
  }
}

export async function paginateSummitTalks(
  paginate: PaginateFunction,
  lang: string
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
  lang: string
) {
  return YEARS.flatMap((year) => {
    const speakersForYear = getSpeakers(year, lang)
    return paginate(speakersForYear, {
      params: { year },
      pageSize: 20
    })
  })
}
