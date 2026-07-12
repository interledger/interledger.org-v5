import React, { useEffect, useRef } from 'react'
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

function attrSelectorValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function selectorsForPath(path: string): string {
  const escaped = attrSelectorValue(path)
  const hintId = attrSelectorValue(`${path}-hint`)

  return [
    `[name="${escaped}"]`,
    `[id="${escaped}"]`,
    `[for="${escaped}"]`,
    `[aria-describedby~="${hintId}"]`,
    `[id="${hintId}"]`
  ].join(',')
}

function findFieldAnchor(path: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selectorsForPath(path))
}

function findFieldContainer(path: string): HTMLElement | null {
  const anchor = findFieldAnchor(path)
  if (!anchor) return null

  let node: HTMLElement | null = anchor
  let fallback: HTMLElement | null = null

  for (let level = 0; level < 10; level++) {
    const parent = node.parentElement
    if (!parent) break

    if (level >= 2 && !fallback) fallback = node

    const parentDisplay = window.getComputedStyle(parent).display
    if (parentDisplay.includes('grid') && level >= 1) return node

    node = parent
  }

  return fallback
}

function setFieldVisibility(paths: string[], visible: boolean) {
  const containers = new Set<HTMLElement>()

  for (const path of paths) {
    const container = findFieldContainer(path)
    if (container) containers.add(container)
  }

  for (const container of containers) {
    container.style.display = visible ? '' : 'none'
  }
}

function applyFieldVisibility(prefix: string, layoutType: string) {
  const showImage = layoutType.startsWith('image')
  const showVideo = layoutType.startsWith('video')
  const showText = layoutType.endsWith('-text')
  const showQuote = layoutType.endsWith('-quote')

  setFieldVisibility([`${prefix}.image`], showImage)
  setFieldVisibility([`${prefix}.imageAlt`], showImage)
  setFieldVisibility([`${prefix}.videoUrl`], showVideo)
  setFieldVisibility([`${prefix}.content`], showText)
  setFieldVisibility([`${prefix}.quote`, `${prefix}.quoteSource`], showQuote)
  setFieldVisibility(
    [
      `${prefix}.cta`,
      `${prefix}.cta.text`,
      `${prefix}.cta.link`,
      `${prefix}.cta.style`,
      `${prefix}.cta.external`
    ],
    showText
  )
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
  const visibilityFrameRef = useRef<number | null>(null)
  const setFieldValue = useForm(
    'SplitLayoutTypePicker',
    (form) => form.onChange
  )

  const scheduleFieldVisibility = (layoutType: string) => {
    if (visibilityFrameRef.current !== null) {
      cancelAnimationFrame(visibilityFrameRef.current)
    }

    visibilityFrameRef.current = requestAnimationFrame(() => {
      visibilityFrameRef.current = null
      applyFieldVisibility(prefix, layoutType)
    })
  }

  const handleSelect = (newValue: LayoutType) => {
    onChange({ target: { name, value: newValue, type: 'text' } })
    clearIrrelevantFields(prefix, newValue, setFieldValue)
    scheduleFieldVisibility(newValue)
  }

  useEffect(() => {
    if (!value) return

    const scheduleApply = () => {
      scheduleFieldVisibility(value)
    }

    scheduleApply()

    const observer = new MutationObserver(scheduleApply)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (visibilityFrameRef.current !== null) {
        cancelAnimationFrame(visibilityFrameRef.current)
        visibilityFrameRef.current = null
      }
    }
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
