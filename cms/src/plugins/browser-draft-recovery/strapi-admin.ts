import BrowserDraftRecoveryRunner from './admin/BrowserDraftRecoveryRunner'

export default {
  register() {},
  bootstrap(app: {
    getPlugin: (name: string) =>
      | {
          injectComponent?: (
            containerName: string,
            blockName: string,
            component: { name: string; Component: unknown }
          ) => void
        }
      | undefined
  }) {
    const cm = app.getPlugin('content-manager')
    if (!cm?.injectComponent) {
      console.warn(
        '[browser-draft-recovery] content-manager injectComponent unavailable'
      )
      return
    }

    cm.injectComponent('editView', 'right-links', {
      name: 'browser-draft-recovery-runner',
      Component: BrowserDraftRecoveryRunner
    })
  }
}
