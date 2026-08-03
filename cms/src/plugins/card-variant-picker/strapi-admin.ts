import { CARD_GRID_VARIANT_LIST_LABEL } from '../../utils/cardGrid'

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
        defaultMessage: `All cards in the grid share one type: ${CARD_GRID_VARIANT_LIST_LABEL}.`
      },
      components: {
        Input: async () => import('./admin/CardVariantPicker')
      }
    })
  }
}
