import {
  setPluginConfig,
  defaultMarkdownPreset
} from '@_sh/strapi-plugin-ckeditor'
import type { PluginConfig, Preset } from '@_sh/strapi-plugin-ckeditor'
import type { HeadingOption } from '@ckeditor/ckeditor5-heading'
import type { Editor } from 'ckeditor5'

// Minimal clipboard callback types for the Google Docs paste cleanup plugin.
interface CKEditorDataTransfer {
  getData(format: string): string
}

interface CKEditorInsertionData {
  dataTransfer: CKEditorDataTransfer
  content: unknown
}

// Strapi document IDs: lowercase alphanumeric, typically 24 chars
const DOC_ID_PATTERN = /^[a-z0-9]{20,26}$/
const DOC_ID_TITLE_PATTERN = /^[a-z0-9]{20,26}\s*\|/

const headingOptionsWithoutH1: HeadingOption[] = [
  { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
  {
    model: 'heading2',
    view: 'h2',
    title: 'Heading 2',
    class: 'ck-heading_heading2'
  },
  {
    model: 'heading3',
    view: 'h3',
    title: 'Heading 3',
    class: 'ck-heading_heading3'
  },
  {
    model: 'heading4',
    view: 'h4',
    title: 'Heading 4',
    class: 'ck-heading_heading4'
  },
  {
    model: 'heading5',
    view: 'h5',
    title: 'Heading 5',
    class: 'ck-heading_heading5'
  },
  {
    model: 'heading6',
    view: 'h6',
    title: 'Heading 6',
    class: 'ck-heading_heading6'
  }
]

const markdownPresetNoH1: Preset = {
  ...defaultMarkdownPreset,
  description: 'Default Markdown editor without H1',
  editorConfig: {
    ...defaultMarkdownPreset.editorConfig,
    heading: { options: headingOptionsWithoutH1 },
    extraPlugins: [
      function cleanGoogleDocsOnPaste(editor: Editor) {
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
      },
      // Preserve markdown footnotes ([^1] refs and [^1]: definitions) through
      // the editor's markdown round-trip. The GFM processor otherwise turns
      // them into plain links + an ordered list, which serialize back as dead
      // anchors and destroy the footnotes on save. We swap footnote markers for
      // private-use placeholders before md->view (so the processor treats them
      // as literal text) and restore them after view->md. Footnotes stay
      // verbatim in Strapi and are rendered by Astro's GFM at build time.
      function preserveFootnotes(editor: Editor) {
        const processor = editor.data.processor as unknown as {
          toView: (markdown: string) => unknown
          toData: (view: unknown) => string
        }
        if (!processor || typeof processor.toView !== 'function') return

        // CKEditor's GFM markdown processor breaks footnotes two ways:
        //  - on load (md -> view) it interprets [^1] into links + an ordered
        //    list, so they no longer round-trip as footnotes;
        //  - on save (view -> md) its writer escapes the bracket ([^1] ->
        //    \[^1]), which renders as literal text instead of a footnote.
        // Fix both edges: escape footnote markers before md->view so the
        // processor leaves them as literal text (shown verbatim in the editor),
        // then strip that escaping after view->md so they persist as real GFM
        // footnotes. Authors write raw markdown; Astro's GFM renders them.
        const FOOTNOTE_MARKER = /\[\^[^\]]+\]/g
        const ESCAPED_FOOTNOTE = /\\(?=\[\^[^\]]+\])/g
        // The writer also escapes markdown punctuation throughout a bare
        // (autolinked) URL — the scheme colon (https:// -> https\://) and host
        // dots (example.com -> example\.com) — which corrupts the rendered
        // link. Match each bare URL and strip the escapes back out. Markdown
        // links ([text](url)) round-trip fine; only plain-text URLs need this.
        const BARE_URL = /https?\\?:\/\/\S+/g

        const originalToView = processor.toView.bind(processor)
        const originalToData = processor.toData.bind(processor)

        processor.toView = (markdown: string) =>
          originalToView(markdown.replace(FOOTNOTE_MARKER, (m) => `\\${m}`))

        processor.toData = (view: unknown) =>
          originalToData(view)
            .replace(ESCAPED_FOOTNOTE, '')
            .replace(BARE_URL, (url) => url.replace(/\\/g, ''))
      }
    ]
  }
}

// Minimal editor for short rich-text fields (e.g. author bios):
// paragraphs, bold, italic, links, and source editing only
const basicMarkdownPreset: Preset = {
  ...markdownPresetNoH1,
  name: 'basicMarkdownPreset',
  description:
    'Basic Markdown editor (paragraphs, bold, italic, links, source)',
  editorConfig: {
    ...markdownPresetNoH1.editorConfig,
    toolbar: [
      'sourceEditing',
      '|',
      'bold',
      'italic',
      'link',
      'numberedList',
      'bulletedList',
      '|',
      'undo',
      'redo'
    ]
  }
}

const myPluginConfig: PluginConfig = {
  presets: [markdownPresetNoH1, basicMarkdownPreset]
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
      /* TEMP UI Fix: image block — divider between asset row and options row */
      [data-image-block-divider="true"] {
        border-top: 1px solid #dcdce4;
        margin-top: 1.5rem;
        padding-top: 1.5rem;
      }
    `
    document.head.appendChild(style)

    // TEMP UI Fix: image block layout has no separator row type; mark options panel via DOM
    function applyImageBlockSeparators() {
      for (const altInput of document.querySelectorAll<HTMLInputElement>(
        'input[name$=".altText"]'
      )) {
        let node: HTMLElement | null = altInput
        for (let depth = 0; depth < 15 && node; depth++) {
          const prev = node.previousElementSibling
          if (prev?.querySelector('[aria-label="Image"]')) {
            node.setAttribute('data-image-block-divider', 'true')
            break
          }
          node = node.parentElement
        }
      }
    }

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

      // TEMP UI Fix: staging link below Settings (clone Settings row DOM, replace anchor only)
      const settingsLink = document.querySelector<HTMLAnchorElement>(
        'nav a[href="/admin/settings"]'
      )
      const settingsLi = settingsLink?.closest('li')
      if (settingsLi && !document.getElementById('staging-site-nav-link')) {
        const li = settingsLi.cloneNode(true) as HTMLLIElement
        li.id = 'staging-site-nav-link'
        const a = li.querySelector('a')
        if (a) {
          const labelClass =
            settingsLink?.querySelector('span')?.className ?? ''
          a.href = 'https://staging--interledger-org-v5.netlify.app/'
          a.target = '_blank'
          a.rel = 'noopener noreferrer'
          a.setAttribute('aria-label', 'Staging site')
          a.removeAttribute('aria-current')
          a.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="20" height="20" fill="#8e8ea9" aria-hidden="true" focusable="false">
              <path d="M156,228a12,12,0,0,1-12,12H112a12,12,0,0,1,0-24h32A12,12,0,0,1,156,228ZM128,116a16,16,0,1,0-16-16A16,16,0,0,0,128,116Zm99.53,40.7-12.36,55.63a19.9,19.9,0,0,1-12.88,14.53A20.16,20.16,0,0,1,195.6,228a19.87,19.87,0,0,1-12.29-4.27L157.17,204H98.83L72.69,223.74A19.87,19.87,0,0,1,60.4,228a20.16,20.16,0,0,1-6.69-1.15,19.9,19.9,0,0,1-12.88-14.53L28.47,156.7a20.1,20.1,0,0,1,4.16-17.14l27.83-33.4A127,127,0,0,1,69.11,69.7c13.27-33.25,37-54.1,46.64-61.52a20,20,0,0,1,24.5,0c9.6,7.42,33.37,28.27,46.64,61.52a127,127,0,0,1,8.65,36.46l27.83,33.4A20.1,20.1,0,0,1,227.53,156.7ZM101.79,180h52.42c19.51-35.7,23-69.78,10.39-101.4C154.4,53,136.2,35.9,128,29.12,119.8,35.9,101.6,53,91.4,78.6,78.78,110.22,82.28,144.3,101.79,180Zm-22.55,8.72a168,168,0,0,1-16.92-47.3l-10,12,10.58,47.64Zm124.43-35.31-10-12a168,168,0,0,1-16.92,47.3l16.33,12.33Z"/>
            </svg>
            <span class="${labelClass}">Staging</span>`

          if (!document.getElementById('staging-site-tooltip')) {
            const tooltip = document.createElement('div')
            tooltip.id = 'staging-site-tooltip'
            tooltip.textContent = 'Staging Site'
            Object.assign(tooltip.style, {
              position: 'fixed',
              background: '#32324D',
              color: '#ffffff',
              padding: '8px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: '9999',
              display: 'none'
            })
            document.body.appendChild(tooltip)
            const showTooltip = () => {
              const rect = li.getBoundingClientRect()
              tooltip.style.left = `${rect.right + 8}px`
              tooltip.style.top = `${rect.top + rect.height / 2}px`
              tooltip.style.transform = 'translateY(-50%)'
              tooltip.style.display = 'block'
            }
            const hideTooltip = () => {
              tooltip.style.display = 'none'
            }
            a.addEventListener('mouseenter', showTooltip)
            a.addEventListener('mouseleave', hideTooltip)
            a.addEventListener('focusin', showTooltip)
            a.addEventListener('focusout', hideTooltip)
          }

          settingsLi.insertAdjacentElement('afterend', li)
        }
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

      applyImageBlockSeparators()

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
