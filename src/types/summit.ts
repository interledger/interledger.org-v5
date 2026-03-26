export interface Talk {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string
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
  questionAnswers: {
    id: number
    question: string
    questionType: string
    answer: string | null
    sort: number
    answerExtra: null
  }[]
}

export interface SessionizeTalk {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string
  speakers: {
    id: string
    name: string
  }[]
  categories: {
    id: number
    name: string
    categoryItems: {
      id: number
      name: string
    }[]
    sort: number
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
