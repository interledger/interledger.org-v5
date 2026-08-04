import path from 'path'
import { createNavigationLifecycle, PATHS } from '../../../../utils'

export default createNavigationLifecycle({
  contentTypeUid: 'api::hackathon-navigation.hackathon-navigation',
  outputPath: path.join(PATHS.CONFIG_ROOT, PATHS.CONFIG.hackathonNavigation),
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
