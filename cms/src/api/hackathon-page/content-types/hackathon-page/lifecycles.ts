import { createPageLifecycle, PATHS } from '../../../utils'
import { HACKATHON_PAGE_CONTENT_POPULATE } from '../../../../utils/contentPopulate'

export default createPageLifecycle({
  contentTypeUid: 'api::hackathon-page.hackathon-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.hackathonPages}`,
  populate: {
    hero: {
      populate: {
        media: { populate: { image: true } },
        backgroundImageMobile: true,
        hero_call_to_action: true
      }
    },
    content: HACKATHON_PAGE_CONTENT_POPULATE
  }
})
