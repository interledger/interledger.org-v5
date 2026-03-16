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

export function getSpeakers(year: string): Speaker[] {
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
  //get 22 speakers to see pagination
  const speakers2022 = Array.from({ length: 11 }).flatMap(() => baseSpeakers)
  switch (year) {
    case '2022':
      return speakers2022
    default:
      console.error(
        'Year is not correct or speakers data is not available for that year'
      )
      return []
  }
}

export function getTalks(year: string): Talk[] {
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
  const sessions2022 = Array.from({ length: 10 }).flatMap(() => baseSessions)
  const sessions2023 = Array.from({ length: 3 }).flatMap(() => baseSessions)
  switch (year) {
    case '2022':
      return sessions2022
    case '2023':
      return sessions2023
    default:
      console.error(
        'Year is not correct or sessions data is not available for that year'
      )
      return []
  }
}

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
