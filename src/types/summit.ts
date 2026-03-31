export interface Talk {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string
  recordingUrl: string | null
  speakers: {
    id: string
    name: string
  }[]
  translations: string[]
  es: {
    title: string | null
    description: string | null
  } | null
}

export type TalkPreview = Omit<Talk, 'speakers'> & {
  speakerImage: string | null
  speakerName: string | null
}

export interface Speaker {
  id: string
  name: string
  bio: string | null
  tagLine: string | null
  profilePicture: string | null
  es: {
    bio: string
  } | null
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
  questionAnswers: QuestionAnswers[]
}

export interface SessionizeTalk {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string
  recordingUrl: string | null
  speakers: {
    id: string
    name: string
  }[]
  categories: Categories[]
  questionAnswers: QuestionAnswers[]
}

interface Categories {
  id: number
  name: string
  categoryItems: {
    id: number
    name: string
  }[]
  sort: number
}
interface QuestionAnswers {
  id: number
  question: string
  questionType: string
  answer: string | null
  sort: number
  answerExtra: null
}
