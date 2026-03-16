import type { PaginateFunction } from 'astro'

export interface Talk {
  id: string
  title: string
}

export function getAllTalks(year: string): Talk[] {
  const sessions2022 = [
    {
      id: '370173',
      title: `2022 State of Interledger`
    },
    {
      id: '385579',
      title:
        ' 2022 TigerBeetle, a Financial Accounting Database for Interledger'
    }
  ]
  const sessions2023 = [
    {
      id: '370173',
      title: `2023 State of Interledger`
    },
    {
      id: '385579',
      title:
        ' 2023 TigerBeetle, a Financial Accounting Database for Interledger'
    }
  ]
  // let sessionsToReturn : Talk[] ;
  switch (year) {
    case '2022':
      return sessions2022
    case '2023':
      return sessions2023
    default:
      console.error('Year is not correct or we do not have data for that year')
      return []
  }
}

export async function paginateSummitTalks(paginate: PaginateFunction) {
  const years = ['2022', '2023', '2024', '2025']

  return years.flatMap((year) => {
    const talksForYear = getAllTalks(year)
    return paginate(talksForYear, {
      params: { year },
      pageSize: 10
    })
  })
}
