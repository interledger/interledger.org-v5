import path from 'path'
import { createNavigationLifecycle, PATHS } from '../../../../utils'

export default createNavigationLifecycle({
  contentTypeUid: 'api::foundation-navigation.foundation-navigation',
  outputPath: path.join(PATHS.CONFIG_ROOT, PATHS.CONFIG.foundationNavigation),
  populate: {
    mainMenu: {
      populate: {
        items: true,
        subGroups: { populate: { items: true } }
      }
    },
    ctaButton: true
  }
})
