/**
 * Lifecycle callbacks for the profile-page content type.
 *
 * Profile pages are flat MDX (frontmatter + markdown body), but their pathSlug is a
 * full site path (e.g. summit/2025/judges/jane-doe, grant/fellowship/jane-doe), so files
 * are written into nested folders under src/content/profiles/ (and src/content/profiles/es/
 * for non-default locales). The first path segment (summit/hackathon/…) determines
 * the section purely through that nesting — no special-casing required.
 *
 * Uses createFlatLocaleMdxLifecycle: on any save, every locale is fetched from
 * Strapi and all locale MDX files are rewritten in one pass.
 */

import {
  getContentPath,
  getTargetRepoRoot,
  createFlatLocaleMdxLifecycle,
  generateProfileMdx,
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
  generateContent: generateProfileMdx,
  populate: {
    photo: true,
    cta: true,
    content: PROFILE_PAGE_CONTENT_POPULATE
  }
})
