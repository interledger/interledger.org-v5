/**
 * Lifecycle callbacks for the faq content type.
 *
 * FAQ pages are flat MDX (frontmatter + markdown body). Files always live
 * under src/content/faqs/ (and src/content/faqs/es/ for non-default locales),
 * regardless of pathSlug depth. pathSlug drives the public URL only.
 *
 * Uses createFlatLocaleMdxLifecycle: on any save, every locale is fetched from
 * Strapi and all locale MDX files are rewritten in one pass.
 */

import {
  getContentPath,
  getTargetRepoRoot,
  createFlatLocaleMdxLifecycle,
  generateFaqMdx,
  pathSlugToMdxFilename,
  FAQ_CONTENT_POPULATE
} from '../../../../utils'
import type { FaqBase } from '../../types'

interface Faq extends FaqBase {
  publishedAt?: string
  locale?: string
  documentId?: string
}

export default createFlatLocaleMdxLifecycle<Faq, 'api::faq.faq'>({
  contentTypeUid: 'api::faq.faq',
  label: 'faq',
  getBaseDir: (locale) => getContentPath(getTargetRepoRoot(), 'faqs', locale),
  toMdxFilename: pathSlugToMdxFilename,
  generateContent: generateFaqMdx,
  populate: { content: FAQ_CONTENT_POPULATE }
})
