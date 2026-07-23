import { createPageLifecycle, PATHS } from '../../../utils'
import { FOUNDATION_PAGE_CONTENT_POPULATE } from '../../../../utils/contentPopulate'

export default createPageLifecycle({
  contentTypeUid: 'api::summit-page.summit-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summitPages}`,
  populate: {
    hero: {
      populate: {
        media: { populate: { image: true } },
        backgroundImageMobile: true,
        hero_call_to_action: true
      }
    },
    seo: { populate: '*' },
    content: FOUNDATION_PAGE_CONTENT_POPULATE
  }
})
