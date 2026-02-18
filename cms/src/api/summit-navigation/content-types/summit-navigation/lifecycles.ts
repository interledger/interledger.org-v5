import path from 'path'
import { createNavigationLifecycle, PATHS } from '@/api/utils'

export default createNavigationLifecycle({
  contentTypeUid: 'api::summit-navigation.summit-navigation',
  outputPath: path.join(PATHS.CONFIG_ROOT, PATHS.CONFIG.summitNavigation)
})
