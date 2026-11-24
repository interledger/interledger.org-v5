export interface SessionLanguages {
  /** Languages the session is held in, e.g. `['English']` or `['English', 'Spanish']`. */
  spoken: string[]
  /** Languages a live translation is offered in, e.g. `['Spanish']`. */
  translatedTo: string[]
}

const TRANSLATION_SUFFIX = /\s+translation available$/i

/**
 * Splits the Sessionize "Will this session be in Spanish, English or Both?"
 * answers (`Talk.translations`) into spoken languages and live translations.
 * An answer reads either as a bare language (`English`) or as
 * `Spanish Translation available`. Summits before 2025 never asked, so their
 * talks give two empty lists.
 */
export function parseSessionLanguages(answers: string[]): SessionLanguages {
  const spoken: string[] = []
  const translatedTo: string[] = []
  for (const answer of answers) {
    const language = answer.replace(TRANSLATION_SUFFIX, '').trim()
    if (!language) continue
    if (language === answer.trim()) spoken.push(language)
    else translatedTo.push(language)
  }
  return { spoken, translatedTo }
}
