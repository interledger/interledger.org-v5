import {
  setPluginConfig,
  defaultMarkdownPreset
} from '@_sh/strapi-plugin-ckeditor'
import type { PluginConfig, Preset } from '@_sh/strapi-plugin-ckeditor'
import type { StrapiApp } from '@strapi/admin/strapi-admin'
import { Rocket } from '@strapi/icons'
// Import only from the unified `ckeditor5` package — never mix with individual
// `@ckeditor/ckeditor5-*` entry points or the admin loads two copies of core
// and throws `ckeditor-duplicated-modules`.
import {
  PasteFromMarkdownExperimental,
  type ClipboardInputTransformationEvent,
  type Editor,
  type HeadingOption
} from 'ckeditor5'
import { formatSplitLayoutPanelTitle } from '../plugins/split-layout-type-picker/admin/layoutTypeLabels'
import { areAdminNoticesDisabled } from '../utils/adminNotice'
import { NOTICES_ROUTE_ID, decideAdminRouteWrap } from '../utils/adminRoutes'
import { resolveWebsiteLink } from '../utils/websiteLink'
import { AdminNoticesLayout } from './notices/AdminNoticesLayout'
import { DraftCheckbox } from './DraftCheckbox'
import {
  DISABLED_ROW_CSS,
  INJECT_COLUMN_IN_TABLE_HOOK,
  markDisabledListRows
} from './disabledListRows'
import {
  collapseSoftWraps,
  healStrandedListItemBreaks,
  prepareHtmlForMarkdown,
  restoreSoftBreaks
} from './markdownRoundTrip'
import { keepPastedImageAlt, uploadPastedDataImages } from './pastedImages'

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
      // Autoformat only converts "- "/"1. " into a list when typed, not when
      // pasted, so a pasted hyphenated list stays literal text; clicking the
      // toolbar's list button then wraps that literal "- " text in <li> tags
      // instead of producing real list items. This plugin parses pasted
      // plain-text/markdown content into real CKEditor content on paste.
      PasteFromMarkdownExperimental,
      // Runs at inputTransformation, ahead of ImageUpload, so the images in
      // the cleaned HTML still go through the upload. It used to replace the
      // content at contentInsertion, after ImageUpload, which kept pasted
      // images as inline base64.
      function cleanGoogleDocsOnPaste(editor: Editor) {
        const clipboardPlugin = editor.plugins.get('ClipboardPipeline')

        clipboardPlugin.on<ClipboardInputTransformationEvent>(
          'inputTransformation',
          (_evt, data) => {
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

              data.content = editor.data.processor.toView(cleanedHtml)
            }
          },
          { priority: 'high' }
        )
      },
      uploadPastedDataImages,
      keepPastedImageAlt,
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
      },
      // Carry Shift+Enter soft breaks and multi-paragraph table cells through
      // the markdown round trip — see markdownRoundTrip.ts for why each
      // transform is needed. Loading also repairs two shapes stored content
      // carries: the stranded <br> left by the old converter, and the soft
      // line wraps the parser would otherwise read as hard breaks.
      function preserveSoftLineBreaks(editor: Editor) {
        const processor = editor.data.processor as unknown as {
          toView?: (markdown: string) => unknown
          _html2markdown?: { parse: (html: string) => string }
        }

        if (typeof processor.toView === 'function') {
          const originalToView = processor.toView.bind(processor)
          processor.toView = (markdown: string) =>
            originalToView(
              collapseSoftWraps(healStrandedListItemBreaks(markdown))
            )
        } else {
          warnOnceAboutBrokenGfmShape(
            'processor.toView is missing — stored content keeps the stranded <br>, and soft wraps still load as hard breaks.'
          )
        }

        const html2markdown = processor._html2markdown
        if (!html2markdown || typeof html2markdown.parse !== 'function') {
          warnOnceAboutBrokenGfmShape(
            'processor._html2markdown.parse is missing — Shift+Enter soft breaks will collapse to an invisible newline, and multi-paragraph table cells will flatten with no separator.'
          )
          return
        }

        const originalParse = html2markdown.parse.bind(html2markdown)
        html2markdown.parse = (html: string) =>
          restoreSoftBreaks(originalParse(prepareHtmlForMarkdown(html)))
      }
    ]
  }
}

// `_html2markdown` is an undocumented CKEditor internal — a version bump could
// rename or drop it with no type error, silently disabling the fixes above.
// Deduped by message so a break logs once, not per editor field.
const warnedGfmShapeMessages = new Set<string>()
function warnOnceAboutBrokenGfmShape(message: string) {
  if (warnedGfmShapeMessages.has(message)) return
  warnedGfmShapeMessages.add(message)
  console.error(
    `[CKEditor] ${message} This likely means a ckeditor5/strapi-plugin-ckeditor upgrade changed the GFM data processor's internal shape — update preserveSoftLineBreaks in cms/src/admin/app.tsx.`
  )
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

/**
 * Captured in `register`, used in `bootstrap`. Strapi hands `register` the full
 * StrapiApp but gives `bootstrap` only a handful of methods — no `router` —
 * and the route wrapping below has to happen in the bootstrap phase.
 */
let strapiApp: StrapiApp | null = null

const adminEnv = typeof process !== 'undefined' ? process.env : undefined

/**
 * Strapi's own Settings link sits at position 9, and the desktop nav sorts by
 * position (`@strapi/admin` useMenu / LeftMenu), so 10 lands right below it.
 * The mobile menu ignores position.
 */
const BELOW_SETTINGS_MENU_POSITION = 10

/**
 * Wrap every authenticated route in the notices layout, so the top bar renders
 * on every admin page inside Strapi's providers.
 *
 * This is the last statement of `bootstrap()` on purpose, and must stay there.
 * `Router.createSettingsLink` looks the settings route up with
 * `findIndex(r => r.path === 'settings/*')` and then tests `if (!settingsIndex)`
 * — once the routes are nested, findIndex returns -1, `!(-1)` is false, and it
 * dereferences `routes[-1]`, white-screening the admin. Every plugin's
 * `addSettingsLink` runs before our bootstrap, so this is safe today; a plugin
 * added later that registers a settings link from its own bootstrap would break
 * it, which is what the guard below fails open on.
 */
function wrapRoutesWithNotices(app: StrapiApp): void {
  app.router.addRoute((routes) => {
    const decision = decideAdminRouteWrap(routes)

    if (decision === 'unrecognized-route-tree') {
      console.error(
        '[cms-notices] settings route not found at the top level — skipping the notice bar'
      )
    }
    if (decision !== 'wrap') return routes

    return [
      {
        id: NOTICES_ROUTE_ID,
        // Imported eagerly, never lazily. A route-level `lazy` that rejects
        // bubbles to the root errorElement, and this route is an ancestor of
        // the entire authenticated admin — so a chunk the deploy just removed
        // would replace the whole CMS with an error page. That is also the
        // exact moment the notice is supposed to be telling the editor to
        // reload, and during an outage the chunk could not load at all. The
        // error boundary inside the layout only covers render-time failures.
        Component: AdminNoticesLayout,
        children: routes
      }
    ]
  })
}

export default {
  register(app: StrapiApp) {
    strapiApp = app
    setPluginConfig(myPluginConfig)

    const websiteLink = resolveWebsiteLink(adminEnv)
    app.addMenuLink({
      to: websiteLink.url,
      target: '_blank',
      icon: Rocket,
      intlLabel: {
        id: 'website-link.menu-link',
        defaultMessage: websiteLink.label
      },
      permissions: [],
      position: BELOW_SETTINGS_MENU_POSITION
    })
  },

  bootstrap(app: {
    registerHook: (name: string, fn: typeof markDisabledListRows) => void
  }) {
    app.registerHook(INJECT_COLUMN_IN_TABLE_HOOK, markDisabledListRows)

    // Renders inside the Publish panel, below the action buttons.
    strapiApp
      ?.getPlugin('content-manager')
      .injectComponent('editView', 'right-links', {
        name: 'draft-checkbox',
        Component: DraftCheckbox
      })

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
      /* TEMP UI Fix: hide Alternative text in the Media Library asset dialog.
         Set alt on localized-media / component fields per locale instead.
         Scoped to [role="dialog"] because that is the only place we mean to
         hide it. Content-form inputs already use path names
         (e.g. content.5.logos.0.alternativeText), so an exact
         [name="alternativeText"] match never hit them — this is clarity, not
         a regression fix for form fields. */
      [role="dialog"] div:has(> div > input[name="alternativeText"]) {
        display: none !important;
      }

      /* INTORG-1037: keep CKEditor content readable after an editor unmounts.
         The plugin renders its theme through a styled-components
         createGlobalStyle *inside every editor field*. styled-components drops
         those global rules as soon as one instance unmounts, so collapsing a
         repeatable component or closing an accordion strips the styling from
         every editor still on the page. Strapi's own design-system reset then
         wins, and lists lose their markers and their indent.

         These rules duplicate the plugin theme, so the result is the same
         whether or not the plugin's copy is currently attached. Remove this
         block once the plugin hoists its GlobalStyle out of the field
         component (upstream: nshenderov/strapi-plugin-ckeditor). */
      .ck-editor__main * {
        font: revert;
        margin: revert;
      }
      .ck-editor__main blockquote,
      .ck-editor__main ol,
      .ck-editor__main p,
      .ck-editor__main ul {
        font-size: 1em;
        line-height: 1.6em;
        padding-top: 0.2em;
        margin-bottom: var(--ck-spacing-large);
      }
      .ck-editor__main ul,
      .ck-editor__main ol {
        list-style: initial;
        margin-left: 2rem;
      }
      .ck-editor__main ol {
        list-style: decimal;
      }
      /* To-do lists draw their own checkboxes and must stay marker-free. */
      .ck-editor__main ul.todo-list {
        list-style: none;
        margin: revert;
        margin-left: 2rem;
      }
      /* Without the plugin theme the counter falls back to static flow and
         lands on top of the text instead of below the editor box. */
      .ck-editor__main + div > .ck-word-count,
      .ck-word-count {
        display: flex;
        position: absolute;
        justify-content: end;
        gap: 0.3rem;
        font-size: 1rem;
        font-weight: 500;
        text-transform: lowercase;
        z-index: 2;
        bottom: -2rem;
        right: 0;
      }
      ${DISABLED_ROW_CSS}
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

    function applySplitLayoutTypeLabels(addedNodes?: Node[]) {
      const formatNodeText = (node: Text) => {
        const text = node.textContent ?? ''
        const trimmed = text.trim()
        if (!trimmed) return
        const parent = node.parentElement
        if (!parent) return
        if (
          parent.closest('button[aria-pressed], input, textarea, pre, code')
        ) {
          return
        }

        const formatted = formatSplitLayoutPanelTitle(trimmed)
        if (!formatted || formatted === trimmed) return

        node.textContent = text.replace(trimmed, formatted)
      }

      if (addedNodes) {
        // Mutation-triggered: only scan the subtrees of newly added nodes
        for (const root of addedNodes) {
          if (!/(image|video)-(text|quote)/.test(root.textContent ?? ''))
            continue
          if (root.nodeType === Node.TEXT_NODE) {
            formatNodeText(root as Text)
          } else {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
            let node: Text | null
            while ((node = walker.nextNode() as Text | null)) {
              formatNodeText(node)
            }
          }
        }
        return
      }

      // Initial full-scan path: only walk text nodes within matched elements
      const matchingEls = Array.from(
        document.querySelectorAll<HTMLElement>('span, button, p, h2, h3')
      ).filter((el) => /(image|video)-(text|quote)/.test(el.textContent ?? ''))

      if (matchingEls.length === 0) return

      for (const el of matchingEls) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
          formatNodeText(node)
        }
      }
    }

    // TEMP UI Fix: apply DOM tweaks (MutationObserver, no polling)
    function applyUITweaks(addedNodes?: Node[]) {
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
        'summit-navigation': 'Summit Navigation',
        'hackathon-navigation': 'Hackathon Navigation'
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
      applySplitLayoutTypeLabels(addedNodes)

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
    let pendingAddedNodes: Node[] = []
    const uiObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          pendingAddedNodes.push(node)
        }
      }
      if (tweakScheduled) return
      tweakScheduled = true
      requestAnimationFrame(() => {
        const addedNodes = pendingAddedNodes
        pendingAddedNodes = []
        applyUITweaks(addedNodes)
        tweakScheduled = false
      })
    })
    uiObserver.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Keep last — see wrapRoutesWithNotices for why the ordering matters.
    // Gating here rather than inside the hooks is what makes the kill switch
    // mean what it says: without the route, nothing mounts and the notices
    // chunk is never even fetched.
    if (strapiApp && !areAdminNoticesDisabled(adminEnv)) {
      wrapRoutesWithNotices(strapiApp)
    }
  }
}
