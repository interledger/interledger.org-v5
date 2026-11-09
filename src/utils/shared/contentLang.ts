// The lang attribute for content in `contentLocale` on a page in `pageLocale`.
// When they differ, the content carries its own lang, so a screen reader reads
// it with the right voice. When they match, it returns undefined and the
// content inherits the page's lang.
export function contentLangAttr(
  contentLocale: string,
  pageLocale: string
): string | undefined {
  return contentLocale === pageLocale ? undefined : contentLocale
}
