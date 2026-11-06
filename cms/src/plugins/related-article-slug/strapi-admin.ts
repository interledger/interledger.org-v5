export default {
  register(app: {
    customFields: { register: (config: Record<string, unknown>) => void }
  }) {
    app.customFields.register({
      name: 'related-article-slug',
      pluginId: 'related-article-slug',
      type: 'string',
      intlLabel: {
        id: 'related-article-slug.label',
        defaultMessage: 'Related post slug'
      },
      intlDescription: {
        id: 'related-article-slug.description',
        defaultMessage: 'A blog post path, like /blog/my-post/.'
      },
      components: {
        Input: async () => import('./admin/RelatedArticleSlugInput')
      }
    })
  }
}
