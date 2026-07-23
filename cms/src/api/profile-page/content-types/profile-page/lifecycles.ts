/**
 * Lifecycle callbacks for the profile-page content type.
 *
 * Profile pages are flat MDX (frontmatter + markdown body). Files always live
 * under src/content/profile/ (and src/content/profile/es/ for non-default locales),
 * regardless of pathSlug depth. pathSlug drives the public URL only.
 *
 * Uses createFlatLocaleMdxLifecycle: on any save, every locale is fetched from
 * Strapi and all locale MDX files are rewritten in one pass.
 */

import {
  getContentPath,
  getTargetRepoRoot,
  createFlatLocaleMdxLifecycle,
  generateProfileMdx,
  pathSlugToMdxFilename,
  PROFILE_PAGE_CONTENT_POPULATE
} from '../../../../utils'
import type { ProfilePageBase } from '../../types'

interface ProfilePage extends ProfilePageBase {
  publishedAt?: string
  locale?: string
  documentId?: string
}

export default createFlatLocaleMdxLifecycle<
  ProfilePage,
  'api::profile-page.profile-page'
>({
  contentTypeUid: 'api::profile-page.profile-page',
  label: 'profile-page',
  getBaseDir: (locale) =>
    getContentPath(getTargetRepoRoot(), 'profiles', locale),
  toMdxFilename: pathSlugToMdxFilename,
  generateContent: generateProfileMdx,
  populate: {
    media: { populate: { image: true } },
    cta: true,
    content: PROFILE_PAGE_CONTENT_POPULATE
  }
})
