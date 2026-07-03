import { createPageLifecycle, PATHS, validateHeroFields } from '../../../utils'
import { FOUNDATION_PAGE_CONTENT_POPULATE } from '../../../../utils/contentPopulate'
import { validateContentBlocks } from '../../../../serializers/blocks'

export default createPageLifecycle({
  contentTypeUid: 'api::summit-page.summit-page',
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.summitPages}`,
  populate: {
    hero: { populate: '*' },
    seo: { populate: '*' },
    content: FOUNDATION_PAGE_CONTENT_POPULATE
  },
  validate: (page) =>
    validateHeroFields(page) ?? validateContentBlocks(page.content)
})
