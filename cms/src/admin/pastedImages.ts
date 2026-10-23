// Import only from the unified `ckeditor5` package (see app.tsx).
import {
  priorities,
  ViewUpcastWriter,
  type ClipboardInputTransformationEvent,
  type Editor,
  type ImageUploadCompleteEvent,
  type ModelElement,
  type ViewElement
} from 'ckeditor5'

/**
 * Pasted images that arrive as `data:` URIs must go through the Strapi upload
 * like any other image. CKEditor's ImageUpload does this for a plain HTML
 * paste, but two paste routes replace the pasted content after it ran: our
 * Google Docs cleanup and PasteFromMarkdownExperimental. Their images stayed
 * inline base64 in the markdown, so the MDX carried the whole file, and the
 * image skipped the media library, the optimizer and the CDN.
 */

const DATA_IMAGE_PATTERN =
  /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i
const FALLBACK_FILE_STEM = 'pasted-image'
const MAX_FILE_STEM_LENGTH = 60

const EXTENSION_BY_SUBTYPE: Record<string, string> = {
  jpeg: 'jpg',
  'svg+xml': 'svg'
}

export function isDataImageSrc(src: unknown): src is string {
  return typeof src === 'string' && DATA_IMAGE_PATTERN.test(src)
}

/** A file name stem from the alt text, so the upload is findable in the media library. */
export function fileStemFromAlt(alt: string | undefined): string {
  const stem = (alt ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_FILE_STEM_LENGTH)
    .replace(/^-+|-+$/g, '')
  return stem || FALLBACK_FILE_STEM
}

export function dataImageToFile(src: string, alt?: string): File | Error {
  const match = DATA_IMAGE_PATTERN.exec(src)
  if (!match) return new Error('Not a base64 data: image URI.')

  const [, mimeType, base64] = match
  let binary: string
  try {
    binary = atob(base64!.replace(/\s/g, ''))
  } catch (error) {
    return new Error('The data: image URI has invalid base64.', {
      cause: error
    })
  }

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const subtype = mimeType!.split('/')[1]!.toLowerCase()
  const extension = EXTENSION_BY_SUBTYPE[subtype] ?? subtype
  return new File([bytes], `${fileStemFromAlt(alt)}.${extension}`, {
    type: mimeType!.toLowerCase()
  })
}

/**
 * Uploads every `data:` image that is still inline after the other paste
 * handlers ran. It marks each one the way ImageUpload does (`uploadId`), so
 * ImageUpload's own converters start the upload and swap in the URL.
 */
export function uploadPastedDataImages(editor: Editor): void {
  if (!editor.plugins.has('FileRepository')) return
  const fileRepository = editor.plugins.get('FileRepository')
  const clipboard = editor.plugins.get('ClipboardPipeline')

  clipboard.on<ClipboardInputTransformationEvent>(
    'inputTransformation',
    (_evt, data) => {
      const inlineImages: ViewElement[] = []
      for (const { item } of editor.editing.view.createRangeIn(data.content)) {
        if (
          item.is('element', 'img') &&
          isDataImageSrc(item.getAttribute('src')) &&
          !item.getAttribute('uploadProcessed')
        ) {
          inlineImages.push(item)
        }
      }
      if (inlineImages.length === 0) return

      const writer = new ViewUpcastWriter(editor.editing.view.document)
      for (const image of inlineImages) {
        const file = dataImageToFile(
          image.getAttribute('src')!,
          image.getAttribute('alt')
        )
        if (file instanceof Error) {
          console.error(`[CKEditor] Pasted image not uploaded: ${file.message}`)
          continue
        }
        const loader = fileRepository.createLoader(file)
        if (!loader) continue
        writer.setAttribute('uploadProcessed', true, image)
        writer.setAttribute('src', '', image)
        writer.setAttribute('uploadId', loader.id, image)
      }
    },
    // ClipboardPipeline turns the view into model content at `low` and stops
    // the event, so this must run just before it and after every other handler.
    { priority: priorities.low + 1 }
  )
}

/**
 * The Strapi CKEditor field sets an uploaded image's alt to the media
 * library's alternative text, or else to the file name. That replaces alt
 * text that came with the paste, so a diagram described in Google Docs
 * ended up with the alt "image.png". This puts the pasted alt back.
 */
export function keepPastedImageAlt(editor: Editor): void {
  if (!editor.plugins.has('ImageUploadEditing')) return
  const imageUpload = editor.plugins.get('ImageUploadEditing')
  const altBeforeUpload = new WeakMap<ModelElement, string>()

  imageUpload.on<ImageUploadCompleteEvent>(
    'uploadComplete',
    (_evt, { imageElement }) => {
      const alt = imageElement.getAttribute('alt')
      if (typeof alt === 'string' && alt.trim())
        altBeforeUpload.set(imageElement, alt)
    },
    { priority: 'highest' }
  )

  imageUpload.on<ImageUploadCompleteEvent>(
    'uploadComplete',
    (_evt, { imageElement }) => {
      const alt = altBeforeUpload.get(imageElement)
      if (alt === undefined) return
      editor.model.change((writer) =>
        writer.setAttribute('alt', alt, imageElement)
      )
    },
    { priority: 'lowest' }
  )
}
