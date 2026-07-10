/**
 * Lifecycle callbacks for the faq-page content type.
 *
 * FAQ pages are flat MDX (frontmatter only — no body yet, see generateFaqMdx).
 * Files always live under src/content/faq/ (and src/content/faq/es/ for
 * non-default locales), regardless of pathSlug depth. pathSlug drives the
 * public URL only.
 *
 * Uses createFlatLocaleMdxLifecycle: on any save, every locale is fetched from
 * Strapi and all locale MDX files are rewritten in one pass.
 */

import {
  getContentPath,
  getTargetRepoRoot,
  createFlatLocaleMdxLifecycle,
  generateFaqMdx,
  pathSlugToMdxFilename
} from '../../../../utils'
import type { FaqPageBase } from '../../types'

interface FaqPage extends FaqPageBase {
  publishedAt?: string
  locale?: string
  documentId?: string
}

export default createFlatLocaleMdxLifecycle<
  FaqPage,
  'api::faq-page.faq-page'
>({
  contentTypeUid: 'api::faq-page.faq-page',
  label: 'faq-page',
  getBaseDir: (locale) => getContentPath(getTargetRepoRoot(), 'faq', locale),
  toMdxFilename: pathSlugToMdxFilename,
  generateContent: generateFaqMdx
})
