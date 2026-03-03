import { shouldSkipMdxExport } from './pageLifecycle'
import { uidToLogLabel } from './mdx'

export function createBlogLifecycle() {
  return {
    async afterCreate(event: Event) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      console.log('EVENT: ', event)
      console.log(
        `📝 Creating ${uidToLogLabel(event.model.uid)} MDX for: ${result.slug}`
      )
    },

    async afterUpdate(event: Event) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      console.log(
        `📝 Updating ${uidToLogLabel(event.model.uid)} MDX for: ${result.slug}`
      )
    },

    async afterDelete(event: Event) {
      if (shouldSkipMdxExport()) return
      const { result } = event
      if (!result) return
      console.log(
        `📝 Deleting ${uidToLogLabel(event.model.uid)} MDX for: ${result.slug}`
      )
    }
  }
}
