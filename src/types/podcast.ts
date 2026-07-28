export type PodcastSeries = 'Interledger Salon' | 'Future Money' | 'Off the Ledger'

export interface Podcast {
  title: string
  description: string
  url: string
  series: PodcastSeries
  episode?: string | null
  coverImage?: string | null
}
