import path from 'path'
import { createNavigationLifecycle, PATHS } from '@/api/utils'

export default createNavigationLifecycle({
  contentTypeUid: 'api::foundation-navigation.foundation-navigation',
  outputPath: path.join(PATHS.CONFIG_ROOT, PATHS.CONFIG.foundationNavigation)
})
