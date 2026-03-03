import { shouldSkipMdxExport } from './pageLifecycle'

interface BlogResult {
  id: number,
  documentId: string,
  title: string,
  description: string,
  slug: string,
  date: string,
  content: string,
  createdAt: string,
  updatedAt: string,
  publishedAt?: Date,
  locale: string,
  pillar: 'vision' | 'mission' |'tech' | 'values',
  authors?: string,
  language?: 'en' | 'es',
  featureImage: null,
  thumbnailImage: null,
  articleBio?: string[],
  tags?: string[],
  localizations: []
}

interface BlogEvent {
  model: { singularName: string},
  result: BlogResult
}

export function createBlogLifecycle() {
  return {
    async afterCreate(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      console.log('EVENT: ', event)
      console.log(
        `📝 Creating ${event.model.singularName} MDX for: ${result.slug}`
      )
    },

    async afterUpdate(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      console.log(
        `📝 Updating ${event.model.singularName} MDX for: ${result.slug}`
      )
    },

    async afterDelete(event: BlogEvent) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      console.log(
        `📝 Deleting ${event.model.singularName} MDX for: ${result.slug}`
      )
    }
  }
}
