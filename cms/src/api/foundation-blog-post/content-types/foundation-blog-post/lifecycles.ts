import { createBlogLifecycle } from '../../../../utils/blogLifecycle'
import { PATHS } from '../../../../utils/paths'

export default createBlogLifecycle({
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.blog}`
})
