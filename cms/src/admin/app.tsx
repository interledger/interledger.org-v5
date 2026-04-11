import {
  setPluginConfig,
  defaultMarkdownPreset
} from '@_sh/strapi-plugin-ckeditor'
import type { PluginConfig, Preset } from '@_sh/strapi-plugin-ckeditor'

// CKEditor type definitions for the APIs we use
interface CKEditorDataTransfer {
  getData(format: string): string
}

interface CKEditorInsertionData {
  dataTransfer: CKEditorDataTransfer
  content: unknown
}

interface CKEditorPlugin {
  on(
    event: string,
    callback: (evt: unknown, data: CKEditorInsertionData) => void,
    options?: { priority: string }
  ): void
}

interface CKEditorPlugins {
  get(name: string): CKEditorPlugin
}

interface CKEditorDataProcessor {
  toView(html: string): unknown
  toModel(view: unknown): unknown
}

interface CKEditorData {
  processor: CKEditorDataProcessor
  toModel(view: unknown): unknown
}

interface CKEditor {
  plugins: CKEditorPlugins
  data: CKEditorData
}

// Strapi document IDs: lowercase alphanumeric, typically 24 chars
const DOC_ID_PATTERN = /^[a-z0-9]{20,26}$/
const DOC_ID_TITLE_PATTERN = /^[a-z0-9]{20,26}\s*\|/

const headingOptionsWithoutH1 = [
  { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
  { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
  { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
  { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
  { model: 'heading5', view: 'h5', title: 'Heading 5', class: 'ck-heading_heading5' },
  { model: 'heading6', view: 'h6', title: 'Heading 6', class: 'ck-heading_heading6' }
]

const markdownPresetNoH1: Preset = {
  ...defaultMarkdownPreset,
  description: 'Default Markdown editor without H1',
  editorConfig: {
    ...defaultMarkdownPreset.editorConfig,
    heading: { options: headingOptionsWithoutH1 },
    extraPlugins: [
      function cleanGoogleDocsOnPaste(editor: CKEditor) {
        const clipboardPlugin = editor.plugins.get('ClipboardPipeline')

        clipboardPlugin.on(
          'contentInsertion',
          (evt: unknown, data: CKEditorInsertionData) => {
            const htmlContent = data.dataTransfer.getData('text/html')

            if (
              htmlContent &&
              (htmlContent.includes('docs-internal-guid') ||
                htmlContent.includes('google-docs'))
            ) {
              const cleanedHtml = htmlContent
                // Remove only the Google Docs wrapper <b> tag with font-weight:normal - is this too fragile?
                .replace(/<b[^>]*font-weight:\s*normal[^>]*>/gi, '')
                .replace(
                  /<\/b>(?=<br class="Apple-interchange-newline">)/gi,
                  ''
                )
                // Remove meta tags
                .replace(/<meta[^>]*>/gi, '')

              // Parse the cleaned HTML and insert it
              const viewFragment = editor.data.processor.toView(cleanedHtml)
              const modelFragment = editor.data.toModel(viewFragment)

              // Replace the content that would be inserted
              data.content = modelFragment
            }
          },
          { priority: 'high' }
        )
      }
    ]
  }
}

const myPluginConfig: PluginConfig = {
  presets: [markdownPresetNoH1]
}

export default {
  register(_app: unknown) {
    setPluginConfig(myPluginConfig)
  },

  bootstrap(_app: unknown) {
    // TEMP UI Fix: inject styles until Strapi supports proper theming
    const style = document.createElement('style')
    style.textContent = `
      /* TEMP UI Fix: minimum textarea height */
      textarea { min-height: 140px !important; }
      /* TEMP UI Fix: hide only the Preview aside (last one), not the one above */
      aside[aria-labelledby="additional-information"]:nth-child(2) { display: none !important; }
      /* TEMP UI Fix: enum dropdowns should show all options without scrolling */
      [role="listbox"] { max-height: none !important; }
    `
    document.head.appendChild(style)

    // TEMP UI Fix: apply DOM tweaks (MutationObserver, no polling)
    function applyUITweaks() {
      // TEMP UI Fix: hide "Open Entity" from the left nav sidebar (record-locking plugin link)
      const openEntityLink = document.querySelector<HTMLAnchorElement>(
        'li a[href*="plugin::record-locking.open-entity"]'
      )
      const openEntityLi = openEntityLink?.closest('li')
      if (openEntityLi && openEntityLi.style.display !== 'none') {
        openEntityLi.style.display = 'none'
      }

      // TEMP UI Fix: single-type page titles show raw document ID; replace h1 and document.title
      const singleTypeTitles: Record<string, string> = {
        'foundation-navigation': 'Foundation Navigation',
        'summit-navigation': 'Summit Navigation'
      }
      const url = window.location.pathname
      for (const [slug, title] of Object.entries(singleTypeTitles)) {
        if (url.includes(slug)) {
          const h1 = document.querySelector('h1')
          if (h1 && DOC_ID_PATTERN.test(h1.textContent?.trim() ?? '')) {
            h1.textContent = title
          }
          if (DOC_ID_TITLE_PATTERN.test(document.title)) {
            document.title = `${title} | Strapi`
          }
          break
        }
      }

      // TEMP UI Fix: rename Save to Publish for consistency
      const buttons = document.querySelectorAll('button')
      buttons.forEach((button) => {
        const span = button.querySelector('span')
        if (
          span &&
          (span.textContent === 'Save' || span.textContent === 'Publish')
        ) {
          span.textContent = 'Publish'
        }
      })
    }
    applyUITweaks()
    let tweakScheduled = false
    const uiObserver = new MutationObserver(() => {
      if (tweakScheduled) return
      tweakScheduled = true
      requestAnimationFrame(() => {
        applyUITweaks()
        tweakScheduled = false
      })
    })
    uiObserver.observe(document.body, {
      childList: true,
      subtree: true
    })
  }
}
