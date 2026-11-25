import type { Translate, UiKey } from './i18'

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

const SESSION_LANGUAGE_KEYS: Record<string, UiKey> = {
  english: 'summit.language_english',
  spanish: 'summit.language_spanish'
}

/**
 * The UI string for a language name read from Sessionize, so the ES pages
 * can show `Inglés` rather than the `English` stored in the JSON. A language
 * with no UI string yet is shown as Sessionize wrote it.
 */
export function translateSessionLanguage(
  language: string,
  t: Translate
): string {
  const key = SESSION_LANGUAGE_KEYS[language.toLowerCase()]
  return key ? t(key) : language
}
