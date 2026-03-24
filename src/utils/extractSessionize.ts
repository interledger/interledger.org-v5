import type {
  Talk,
  TalkPreview,
  Speaker,
  SessionizeSpeaker,
  SessionizeTalk
} from '@/types/summit'

export async function getSpeakers(
  year: string,
  articleId?: string
): Promise<Speaker[]> {
  const data = await import(`../data/sessionize/${year}-speakers.json`)

  // Question ID for Spanish bio in Sessionize
  const SPANISH_BIO_ID = 114100
  const speakers: Speaker[] = data.default.map((speaker: SessionizeSpeaker) => {
    const sessions = speaker.sessions.map((session) => ({
      id: String(session.id),
      title: session.name
    }))

    const spanishBioAnswer = speaker.questionAnswers.find(
      (q) => q.id === SPANISH_BIO_ID
    )
    const spanishBio = spanishBioAnswer?.answer
    return {
      id: speaker.id,
      name: speaker.fullName,
      bio: speaker.bio,
      tagLine: speaker.tagLine,
      profilePicture: speaker.profilePicture,
      es: spanishBio ? { bio: spanishBio } : null,
      sessions
    }
  })

  if (articleId) {
    return speakers.filter((speaker) => {
      return speaker.sessions.some((session) => session.id === articleId)
    })
  }

  return speakers
}

export async function getTalks(
  year: string,
  authorId?: string
): Promise<Talk[]> {
  const data = await import(`../data/sessionize/${year}-talks.json`)

  const TRANSLATION_ID = 107734
  const SPANISH_TITLE_ID = 114105
  const SPANISH_DESC_ID = 114099

  // Filter out sessions without speakers before mapping
  // These are non-talk events (e.g. coffee breaks, group photos, social events)
  const talks: Talk[] = data.default[0].sessions
    .filter((talk: SessionizeTalk) => talk.speakers?.length > 0)
    .map((talk: SessionizeTalk) => {
      const translations =
        talk.categories
          .find((item) => item.id === TRANSLATION_ID)
          ?.categoryItems.map((i) => i.name) ?? []
      const spanishTitle =
        talk.questionAnswers.find((item) => item.id === SPANISH_TITLE_ID)
          ?.answer ?? null
      const spanishDescription =
        talk.questionAnswers.find((item) => item.id === SPANISH_DESC_ID)
          ?.answer ?? null
      const es =
        spanishTitle || spanishDescription
          ? {
              title: spanishTitle,
              description: spanishDescription
            }
          : null

      if (talk.speakers.length)
        return {
          id: talk.id,
          title: talk.title,
          description: talk.description,
          startsAt: talk.startsAt,
          endsAt: talk.endsAt,
          speakers: talk.speakers,
          translations,
          es
        }
    })

  if (authorId) {
    return talks.filter((talk) =>
      talk.speakers.some((speaker) => speaker.id === authorId)
    )
  }

  return talks
}

export async function getTalkPreviews(year: string): Promise<TalkPreview[]> {
  const [talks, sessionizeSpeakers] = await Promise.all([
    getTalks(year),
    import(`../data/sessionize/${year}-speakers.json`) as Promise<{
      default: SessionizeSpeaker[]
    }>
  ])
  const allSpeakers = sessionizeSpeakers.default

  return talks.map(({ speakers, ...talk }) => {
    const speaker = allSpeakers.find((s) => s.id === speakers[0]?.id)

    return {
      ...talk,
      speakerImage: speaker?.profilePicture ?? null
    }
  })
}
