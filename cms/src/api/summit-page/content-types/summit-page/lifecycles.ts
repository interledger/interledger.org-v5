import { createPageLifecycle, PATHS } from '../../../utils'
import { FOUNDATION_PAGE_CONTENT_POPULATE } from '../../../../utils/contentPopulate'

export default createPageLifecycle({
  contentTypeUid: 'api::summit-page.summit-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summitPages}`,
  populate: {
    hero: { populate: '*' },
    seo: { populate: '*' },
    content: FOUNDATION_PAGE_CONTENT_POPULATE
  }
})
