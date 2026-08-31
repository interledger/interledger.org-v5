const DOCUMENT_TITLE_SEPARATOR = ' | '

/** Browser tab title: `{siteName} | {pageTitle}` when a page title is present. */
export function formatDocumentTitle(
  siteName: string,
  pageTitle?: string
): string {
  const trimmedSiteName = siteName.trim()
  const trimmedPageTitle = pageTitle?.trim()

  if (!trimmedPageTitle || trimmedPageTitle === trimmedSiteName) {
    return trimmedSiteName
  }

  return `${trimmedSiteName}${DOCUMENT_TITLE_SEPARATOR}${trimmedPageTitle}`
}
