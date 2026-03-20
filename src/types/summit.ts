export interface Talk {
  id: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  speakers: {
    id: string
    name: string
  }[]
  translations: string[]
  es?: {
    title: string
    description: string
  }
}

export interface Speaker {
  id: string
  name: string
  bio: string
  tagLine: string
  profilePicture: string
  es?: {
    bio: string
  }
  sessions: {
    id: string
    title: string
  }[]
}
