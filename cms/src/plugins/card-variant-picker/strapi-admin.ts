export default {
  register(app: {
    customFields: { register: (config: Record<string, unknown>) => void }
  }) {
    app.customFields.register({
      name: 'card-variant',
      pluginId: 'card-variant-picker',
      type: 'string',
      intlLabel: {
        id: 'card-variant-picker.card-variant.label',
        defaultMessage: 'Card variant'
      },
      intlDescription: {
        id: 'card-variant-picker.card-variant.description',
        defaultMessage:
          'Choose which card type this grid displays. Only one variant per grid.'
      },
      components: {
        Input: async () => import('./admin/CardVariantPicker')
      }
    })
  }
}
