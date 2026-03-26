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

export interface SessionizeSpeaker {
  id: string
  fullName: string
  bio: string | null
  tagLine: string | null
  profilePicture: string | null
  sessions: {
    id: number
    name: string
  }[]
  questionAnswers: {
    id: number
    question: string
    questionType: string
    answer: string | null
    sort: number
    answerExtra: null
  }[]
}
