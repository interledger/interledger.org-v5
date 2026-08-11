import BrowserDraftRecoveryRunner from './admin/BrowserDraftRecoveryRunner'

/**
 * Browser localStorage recovery for unsaved Content Manager edits.
 * Invisible runner mounted on the edit view (console logs only).
 */
export default {
  register() {
    // No custom fields.
  },
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
    if (!cm) {
      console.warn('[browser-draft-recovery] content-manager plugin not found')
      return
    }

    // Mount invisible runner inside the edit view (InjectionZone right-links).
    if (typeof cm.injectComponent === 'function') {
      cm.injectComponent('editView', 'right-links', {
        name: 'browser-draft-recovery-runner',
        Component: BrowserDraftRecoveryRunner
      })

      console.log('[browser-draft-recovery] registered on editView.right-links')
      return
    }

    console.warn(
      '[browser-draft-recovery] content-manager injectComponent unavailable'
    )
  }
}
