export default {
  register(app: {
    customFields: { register: (config: Record<string, unknown>) => void }
  }) {
    app.customFields.register({
      name: 'path-slug',
      pluginId: 'path-slug',
      type: 'string',
      intlLabel: {
        id: 'path-slug.label',
        defaultMessage: 'Path slug'
      },
      intlDescription: {
        id: 'path-slug.description',
        defaultMessage: 'A page path, like /about-us/.'
      },
      components: {
        Input: async () => import('./admin/PathSlugInput')
      }
    })
  }
}
