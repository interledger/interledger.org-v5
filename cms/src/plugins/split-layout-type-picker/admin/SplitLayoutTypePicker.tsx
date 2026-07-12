import React, { useEffect } from 'react'
import { useForm } from '@strapi/admin/strapi-admin'

type LayoutType = 'image-text' | 'image-quote' | 'video-text' | 'video-quote'

interface InputProps {
  name: string
  onChange: (event: {
    target: { name: string; value: string; type: string }
  }) => void
  value?: string
  error?: string
  hint?: string
}

const LAYOUTS: { value: LayoutType; label: string; icon: React.ReactNode }[] = [
  {
    value: 'image-text',
    label: 'Image + Text',
    icon: (
      <svg
        viewBox="0 0 56 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="56"
        height="36"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="54"
          height="34"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
        <line
          x1="28"
          y1="1"
          x2="28"
          y2="35"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <rect
          x="5"
          y="8"
          width="18"
          height="12"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 16l4-4 3 3 2.5-2.5L21 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="12" r="1.5" fill="currentColor" />
        <line
          x1="32"
          y1="10"
          x2="51"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="15"
          x2="51"
          y2="15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="20"
          x2="44"
          y2="20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    value: 'image-quote',
    label: 'Image + Quote',
    icon: (
      <svg
        viewBox="0 0 56 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="56"
        height="36"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="54"
          height="34"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
        <line
          x1="28"
          y1="1"
          x2="28"
          y2="35"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <rect
          x="5"
          y="8"
          width="18"
          height="12"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 16l4-4 3 3 2.5-2.5L21 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="12" r="1.5" fill="currentColor" />
        <path
          d="M33 10c0 2.5-1 4-3 4v2c3 0 5-2 5-6v-2h-2v2zm6 0c0 2.5-1 4-3 4v2c3 0 5-2 5-6v-2h-2v2z"
          fill="currentColor"
        />
        <line
          x1="32"
          y1="22"
          x2="48"
          y2="22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      </svg>
    )
  },
  {
    value: 'video-text',
    label: 'Video + Text',
    icon: (
      <svg
        viewBox="0 0 56 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="56"
        height="36"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="54"
          height="34"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
        <line
          x1="28"
          y1="1"
          x2="28"
          y2="35"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <circle cx="14" cy="18" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11.5 14.5l8 3.5-8 3.5V14.5z" fill="currentColor" />
        <line
          x1="32"
          y1="10"
          x2="51"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="15"
          x2="51"
          y2="15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="20"
          x2="44"
          y2="20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    value: 'video-quote',
    label: 'Video + Quote',
    icon: (
      <svg
        viewBox="0 0 56 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="56"
        height="36"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="54"
          height="34"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
        <line
          x1="28"
          y1="1"
          x2="28"
          y2="35"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <circle cx="14" cy="18" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11.5 14.5l8 3.5-8 3.5V14.5z" fill="currentColor" />
        <path
          d="M33 10c0 2.5-1 4-3 4v2c3 0 5-2 5-6v-2h-2v2zm6 0c0 2.5-1 4-3 4v2c3 0 5-2 5-6v-2h-2v2z"
          fill="currentColor"
        />
        <line
          x1="32"
          y1="22"
          x2="48"
          y2="22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      </svg>
    )
  }
]

/**
 * Walk up from an element until we find a node whose parent has more than one
 * child — that means the node is a grid column/cell alongside sibling fields.
 */
function findGridItem(
  el: Element | null,
  minLevels = 2,
  maxLevels = 10
): HTMLElement | null {
  if (!el) return null
  let node: HTMLElement | null = el as HTMLElement
  for (let i = 0; i < maxLevels; i++) {
    const parent = node.parentElement
    if (!parent) return null
    if (i >= minLevels && parent.children.length > 1) return node
    node = parent
  }
  return null
}

function positionLabelText(layoutType: string): string {
  return layoutType.startsWith('video') ? 'Video position' : 'Image position'
}

function positionHintText(layoutType: string): string {
  return layoutType.startsWith('video')
    ? 'Controls which side the video appears on.'
    : 'Controls which side the image appears on.'
}

/**
 * Strapi FieldLabel renders as:
 *   <label>Image position<span aria-hidden="true">*</span></label>
 * The visible text is a direct text node; the aria-hidden span is only the
 * required asterisk. Updating that span with the full label duplicates it in red.
 */
function updatePositionLabel(
  imagePositionItem: HTMLElement | null,
  layoutType: string
) {
  const label = imagePositionItem?.querySelector<HTMLElement>('label, legend')
  if (!label) return

  const newText = positionLabelText(layoutType)
  const requiredSpan = label.querySelector<HTMLElement>(
    'span[aria-hidden="true"]'
  )

  let updatedVisibleText = false
  for (const node of label.childNodes) {
    if (node === requiredSpan) continue
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = newText
      updatedVisibleText = true
    }
  }

  if (!updatedVisibleText) {
    const visibleSpan = Array.from(label.querySelectorAll('span')).find(
      (span) => span.getAttribute('aria-hidden') !== 'true'
    )
    if (visibleSpan) {
      visibleSpan.textContent = newText
      updatedVisibleText = true
    }
  }

  if (!updatedVisibleText) {
    label.insertBefore(document.createTextNode(newText), requiredSpan)
  }

  if (requiredSpan) {
    requiredSpan.textContent = '*'
  }
}

function updatePositionHint(
  imagePositionItem: HTMLElement | null,
  layoutType: string
) {
  if (!imagePositionItem) return
  const hint = imagePositionItem.querySelector<HTMLElement>('p[id$="-hint"]')
  if (hint) {
    hint.textContent = positionHintText(layoutType)
  }
}

function applyFieldVisibility(prefix: string, layoutType: string) {
  const showImage = layoutType.startsWith('image')
  const showVideo = layoutType.startsWith('video')
  const showText = layoutType.endsWith('-text')
  const showQuote = layoutType.endsWith('-quote')

  // Row order in the grid: imagePosition[0] | image[1] | videoUrl[2]
  // Strapi's Select renders as a combobox <button>, not a native <select> with name attr,
  // so we find imagePositionItem by grid index rather than by [name] selector.
  const videoUrlEl = document.querySelector<HTMLElement>(
    `input[name="${prefix}.videoUrl"]`
  )
  const videoUrlItem = findGridItem(videoUrlEl)
  let imagePositionItem: HTMLElement | null = null
  if (videoUrlItem) {
    const gridRow = videoUrlItem.parentElement
    if (gridRow) {
      imagePositionItem = (gridRow.children[0] as HTMLElement) ?? null
      const imageItem = gridRow.children[1] as HTMLElement | undefined
      if (imageItem) imageItem.style.display = showImage ? '' : 'none'
    }
    videoUrlItem.style.display = showVideo ? '' : 'none'
  }

  const imageAltEl = document.querySelector<HTMLElement>(
    `input[name="${prefix}.imageAlt"]`
  )
  const imageAltRow = findGridItem(imageAltEl)?.parentElement as
    | HTMLElement
    | undefined
  if (imageAltRow) imageAltRow.style.display = showImage ? '' : 'none'

  updatePositionLabel(imagePositionItem, layoutType)
  updatePositionHint(imagePositionItem, layoutType)

  // quote + quoteSource share a grid row — toggle the entire row
  const quoteEl = document.querySelector<HTMLElement>(
    `textarea[name="${prefix}.quote"]`
  )
  const quoteItem = findGridItem(quoteEl)
  const quoteRow = quoteItem?.parentElement as HTMLElement | undefined
  if (quoteRow) quoteRow.style.display = showQuote ? '' : 'none'

  // content is only rendered by SplitLayout.astro in the non-quote branch —
  // same rule as cta below. CKEditor's field has no [name] attribute, but the
  // plugin renders its hint paragraph with a predictable, prefix-scoped id
  // (`${prefix}.content-hint`) — its parent is the whole field (label,
  // editor, word count, expand button). No row/sibling guessing needed.
  const contentHint = document.querySelector<HTMLElement>(
    `[id="${prefix}.content-hint"]`
  )
  const contentRow = contentHint?.parentElement as HTMLElement | undefined
  if (contentRow) contentRow.style.display = showText ? '' : 'none'

  // cta is the row immediately after the quote row
  const ctaRow = quoteRow?.nextElementSibling as HTMLElement | undefined
  if (ctaRow) ctaRow.style.display = showText ? '' : 'none'
}

// The picker only hides fields for the non-selected variant — it never clears
// their values. Without this, switching layoutType leaves stale data behind
// that still gets serialized (e.g. an old quote surviving a switch to Image +
// Text). Mirrors the same show/hide rules as applyFieldVisibility.
function clearIrrelevantFields(
  prefix: string,
  layoutType: LayoutType,
  setFieldValue: (path: string, value: unknown) => void
) {
  const showImage = layoutType.startsWith('image')
  const showVideo = layoutType.startsWith('video')
  const showText = layoutType.endsWith('-text')
  const showQuote = layoutType.endsWith('-quote')

  if (!showImage) {
    setFieldValue(`${prefix}.image`, null)
    setFieldValue(`${prefix}.imageAlt`, null)
  }
  if (!showVideo) setFieldValue(`${prefix}.videoUrl`, null)
  if (!showText) {
    setFieldValue(`${prefix}.content`, null)
    setFieldValue(`${prefix}.cta`, null)
  }
  if (!showQuote) {
    setFieldValue(`${prefix}.quote`, null)
    setFieldValue(`${prefix}.quoteSource`, null)
  }
}

export default function SplitLayoutTypePicker({
  name,
  onChange,
  value,
  error,
  hint
}: InputProps) {
  const prefix = name.replace(/\.layoutType$/, '')
  const setFieldValue = useForm(
    'SplitLayoutTypePicker',
    (form) => form.onChange
  )

  const handleSelect = (newValue: LayoutType) => {
    onChange({ target: { name, value: newValue, type: 'text' } })
    clearIrrelevantFields(prefix, newValue, setFieldValue)
    // Defer one frame so Strapi's re-render finishes before we query the DOM
    requestAnimationFrame(() => applyFieldVisibility(prefix, newValue))
  }

  // Re-apply whenever the value changes (including initial load of saved content)
  useEffect(() => {
    if (!value) return
    // Small delay for Strapi's form to finish rendering on load
    const id = setTimeout(() => applyFieldVisibility(prefix, value), 80)
    return () => clearTimeout(id)
  }, [value, prefix])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px'
        }}
      >
        {LAYOUTS.map((layout) => {
          const isSelected = value === layout.value
          return (
            <button
              key={layout.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelect(layout.value)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 10px',
                border: `2px solid ${isSelected ? '#4945FF' : '#DCDCE4'}`,
                borderRadius: '6px',
                background: isSelected ? '#EEF0FF' : '#FFFFFF',
                cursor: 'pointer',
                color: isSelected ? '#4945FF' : '#32324D',
                transition: 'border-color 0.15s, background 0.15s',
                fontFamily: 'inherit',
                fontSize: '11px',
                fontWeight: isSelected ? '600' : '400',
                lineHeight: '1.3',
                textAlign: 'center' as const
              }}
            >
              {layout.icon}
              <span>{layout.label}</span>
            </button>
          )
        })}
      </div>
      {hint && !error && (
        <p style={{ fontSize: '12px', color: '#666687', margin: 0 }}>{hint}</p>
      )}
      {error && (
        <p style={{ fontSize: '12px', color: '#D02B20', margin: 0 }}>{error}</p>
      )}
    </div>
  )
}
