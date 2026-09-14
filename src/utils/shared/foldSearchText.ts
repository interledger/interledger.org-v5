/** Combining marks stripped after NFD so `é` and `e` compare equal. */
const COMBINING_DIACRITICAL_MARKS = /[\u0300-\u036f]/g

/**
 * Latin letters that do not decompose under NFD. Same set as `generateSlug`,
 * minus characters NFD already handles (ğ, ş).
 */
const SEARCH_TRANSLITERATIONS: Record<string, string> = {
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ð: 'd',
  þ: 'th',
  ß: 'ss',
  ł: 'l',
  ı: 'i'
}

/**
 * Case- and accent-fold a string for substring search. Keeps non-Latin
 * letters (CJK, etc.) so those queries still match.
 */
export function foldSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICAL_MARKS, '')
    .replace(/[æœøðþßłı]/g, (ch) => SEARCH_TRANSLITERATIONS[ch] ?? ch)
}
