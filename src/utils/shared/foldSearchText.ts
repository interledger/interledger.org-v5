/** Combining marks stripped after NFD so `é` and `e` compare equal. */
const COMBINING_DIACRITICAL_MARKS = /[\u0300-\u036f]/g

/**
 * Latin letters that do not decompose under NFD. Lowercase only: folding
 * lowercases first, so `Ø` is already `ø` by the time this runs.
 */
const SEARCH_TRANSLITERATIONS: Record<string, string> = {
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ð: 'd',
  đ: 'd',
  þ: 'th',
  ß: 'ss',
  ł: 'l',
  ı: 'i',
  ħ: 'h',
  ŧ: 't',
  ŋ: 'ng',
  ſ: 's',
  ĸ: 'k'
}

/**
 * Apostrophes and quotes are not part of the word. Straight, curly, and
 * prime forms all drop, so `what's`, `what’s`, and `whats` compare equal.
 * `#` and `_` stay: grantee search treats `C#` and `A_B` as literal queries.
 */
const APOSTROPHES_AND_QUOTES =
  /['\u2018\u2019\u201A\u201B\u2032`\u00B4\u02BC\u02B9"\u201C\u201D\u201E\u201F\u00AB\u00BB\u2039\u203A]/g

/**
 * Hyphens and dashes become a space so `Tenorio-Fornés` matches
 * `tenorio fornes`, and an en dash matches a hyphen the user typed.
 */
const DASHES = /[\u002D\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g

/**
 * Characters that split a word without being a space the user would type.
 * Alternation, not a class: U+200D is a joiner, and a class containing it
 * trips `no-misleading-character-class`.
 */
const INVISIBLE = /\u00AD|\u200B|\u200C|\u200D|\u2060|\uFEFF/g

/**
 * Case- and accent-fold a string for substring search. Also flattens the
 * punctuation and space variants that show up in pasted titles (curly
 * apostrophes, en dashes, non-breaking spaces) so both sides of a comparison
 * meet. Keeps non-Latin letters (CJK, etc.) so those queries still match.
 */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICAL_MARKS, '')
    .replace(/[æœøðđþßłıħŧŋſĸ]/g, (ch) => SEARCH_TRANSLITERATIONS[ch] ?? ch)
    .replace(INVISIBLE, '')
    .replace(APOSTROPHES_AND_QUOTES, '')
    .replace(DASHES, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
