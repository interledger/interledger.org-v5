import { createPageLifecycle, PATHS } from '../../../utils'
import { HACKATHON_PAGE_CONTENT_POPULATE } from '../../../../utils/contentPopulate'

export default createPageLifecycle({
  contentTypeUid: 'api::hackathon-page.hackathon-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.hackathonPages}`,
  populate: {
    content: HACKATHON_PAGE_CONTENT_POPULATE
  }
})
