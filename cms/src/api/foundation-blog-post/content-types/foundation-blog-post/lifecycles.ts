import { createBlogLifecycle, PATHS } from '../../../../utils'

export default createBlogLifecycle({
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.blog}`
})
