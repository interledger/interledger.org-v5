export const YEARS = ['2022', '2023', '2024', '2025'].sort()
export const currentSummitYear = YEARS.at(-1)

export const sessionizeApiMap: Record<
  string,
  { speakersUrl: string; talksUrl: string }
> = {
  '2025': {
    speakersUrl: 'https://sessionize.com/api/v2/ts62m835/view/Speakers',
    talksUrl: 'https://sessionize.com/api/v2/ts62m835/view/Sessions'
  },
  '2024': {
    speakersUrl: 'https://sessionize.com/api/v2/m24b8gc6/view/Speakers',
    talksUrl: 'https://sessionize.com/api/v2/m24b8gc6/view/Sessions'
  },
  '2023': {
    speakersUrl: 'https://sessionize.com/api/v2/7ueublag/view/Speakers',
    talksUrl: 'https://sessionize.com/api/v2/7ueublag/view/Sessions'
  },
  '2022': {
    speakersUrl: 'https://sessionize.com/api/v2/lbapz770/view/Speakers',
    talksUrl: 'https://sessionize.com/api/v2/lbapz770/view/Sessions'
  }
}
