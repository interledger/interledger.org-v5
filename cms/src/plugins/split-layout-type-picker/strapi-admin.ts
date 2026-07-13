export default {
  register(app: {
    customFields: { register: (config: Record<string, unknown>) => void }
  }) {
    app.customFields.register({
      name: 'layout-type',
      pluginId: 'split-layout-type-picker',
      type: 'string',
      intlLabel: {
        id: 'split-layout-type-picker.layout-type.label',
        defaultMessage: 'Layout'
      },
      intlDescription: {
        id: 'split-layout-type-picker.layout-type.description',
        defaultMessage:
          'Choose the media and content combination for this split layout'
      },
      components: {
        Input: async () => import('./admin/SplitLayoutTypePicker')
      }
    })
  }
}
