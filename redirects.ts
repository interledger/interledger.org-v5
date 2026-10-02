import redirectConfigJson from './src/config/redirects.json'
import {
  parseRedirectConfig,
  toAstroRedirects
} from './src/utils/shared/redirects.ts'

// Literal redirects are managed in Strapi (Content Manager → Redirect), which
// rewrites src/config/redirects.json on every save — don't hand-edit it; the
// next CMS save overwrites it. Rules with a :param or * belong in
// public/_redirects, where their order can be controlled [INTORG-1112].
const redirectConfig = parseRedirectConfig(redirectConfigJson)
if (redirectConfig instanceof Error) {
  // A malformed file must fail the build, not ship a site without redirects.
  throw new Error(`src/config/redirects.json: ${redirectConfig.message}`)
}

export const redirects = toAstroRedirects(redirectConfig)
