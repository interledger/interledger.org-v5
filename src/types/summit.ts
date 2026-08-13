export const SESSIONIZE_SUPPORTED_LOCALES = ['es'] as const

export type SessionizeSupportedLocale =
  (typeof SESSIONIZE_SUPPORTED_LOCALES)[number]

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
  /**
   * Always populated: `getTalkPreviews` substitutes the no-photo SVG when
   * Sessionize has no photo for the speaker, so components can pass this
   * straight to `OptimizedImage`. Contrast `SessionizeSpeaker.profilePicture`,
   * which is the nullable API shape.
   */
  speakerImage: string
  speakerName: string | null
}

export interface Speaker {
  id: string
  name: string
  bio: string | null
  tagLine: string | null
  /** Always populated — see `TalkPreview.speakerImage`. */
  profilePicture: string
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
