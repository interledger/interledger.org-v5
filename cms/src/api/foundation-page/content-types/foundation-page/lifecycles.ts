import { createPageLifecycle, PATHS } from '../../../utils'
import { FOUNDATION_PAGE_CONTENT_POPULATE } from '../../../../utils/contentPopulate'

export default createPageLifecycle({
  contentTypeUid: 'api::foundation-page.foundation-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.foundationPages}`,
  populate: {
    hero: { populate: '*' },
    seo: { populate: '*' },
    content: FOUNDATION_PAGE_CONTENT_POPULATE
  }
})
