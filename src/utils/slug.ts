/**
 * Generates a URL slug following Drupal Pathauto settings.
 *
 * Settings applied:
 *  - Separator: hyphen (-)
 *  - Maximum text length: 100
 *  - Transliterate accented/non-ASCII chars to US-ASCII
 *  - Remove stop words: a, an, as, at, before, but, by, for, from, is, in,
 *    into, like, of, off, on, onto, per, since, than, the, this, that, to,
 *    up, via, with
 *  - Punctuation rules per Drupal config:
 *      Hyphen (-)  → replaced by separator (-)
 *      All other listed punctuation → removed
 **/
export function generateSlug(input: string) {
  if (!input) return ''

  const separator = '-'
  const maxLength = 100
  const stopWords = new Set([
    'a',
    'an',
    'as',
    'at',
    'before',
    'but',
    'by',
    'for',
    'from',
    'is',
    'in',
    'into',
    'like',
    'of',
    'off',
    'on',
    'onto',
    'per',
    'since',
    'than',
    'the',
    'this',
    'that',
    'to',
    'up',
    'via',
    'with'
  ])

  // 1. Transliterate accented / non-ASCII characters (basic version) (e.g. é → e)
  let slug = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Manual map for characters not handled by NFD decomposition
  const transliterationMap: Record<string, string> = {
    æ: 'ae',
    œ: 'oe',
    ø: 'o',
    ð: 'd',
    þ: 'th',
    ß: 'ss',
    ł: 'l',
    ğ: 'g',
    ş: 's',
    ı: 'i',
    Æ: 'ae',
    Œ: 'oe',
    Ø: 'o',
    Ð: 'd',
    Þ: 'th',
    ẞ: 'ss',
    Ł: 'l',
    Ğ: 'g',
    Ş: 's',
    İ: 'i'
  }
  slug = slug.replace(/[^\x20-\x7E]/g, (ch) => transliterationMap[ch] ?? '')

  // 2. Lowercase
  slug = slug.toLowerCase()

  // 3. Remove punctuation (based on Drupal rules)
  // Strategy: punctuation that "glues" words together (e.g. "100.00", "a/b",
  // "key=value") must become a space so the tokens stay separate.
  // Pure decoration (quotes, brackets, etc.) can just be deleted.
  const wordBoundaryChars = ['-', '.', '/', '\\', '?', '=', '&', '#', '@']
  wordBoundaryChars.forEach((ch) => {
    slug = slug.split(ch).join(' ')
  })

  const charsToRemove = [
    '"',
    "'",
    '`',
    ',',
    '_',
    ':',
    ';',
    '|',
    '{',
    '[',
    '}',
    ']',
    '+',
    '*',
    '%',
    '^',
    '$',
    '!',
    '~',
    '(',
    ')',
    '<',
    '>'
  ]
  charsToRemove.forEach((ch) => {
    slug = slug.split(ch).join('')
  })

  // 4. Replace spaces with separator
  slug = slug.replace(/\s+/g, separator)

  // 5. Remove stop words
  slug = slug
    .split(separator)
    .filter((word) => word && !stopWords.has(word))
    .join(separator)

  //6. Remove duplicate separators
  // slug = slug.replace(new RegExp(`${separator}+`, 'g'), separator);

  // 7. Trim separators from ends
  slug = slug.replace(new RegExp(`^${separator}|${separator}$`, 'g'), '')

  // 8. Enforce max length (cut cleanly)
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength)
    slug = slug.replace(new RegExp(`${separator}[^${separator}]*$`), '')
  }
  return slug
}
