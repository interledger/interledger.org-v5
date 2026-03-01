<<<<<<< HEAD
import { createBlogLifecycle } from '../../../../utils/blogLifecycle'
import { PATHS } from '../../../../utils/paths'

export default createBlogLifecycle({
  outputDir: `${PATHS.CONTENT_ROOT}/${PATHS.CONTENT.blog}`
})
=======
import { createBlogLifecycle } from '../../../utils'

export default createBlogLifecycle()
>>>>>>> 3d653ac (feat(cms): add foundation blog post lifecycle MDX sync)
