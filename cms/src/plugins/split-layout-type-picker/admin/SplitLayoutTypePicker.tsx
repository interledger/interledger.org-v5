import React, { useEffect, useRef } from 'react'
import styled from 'styled-components'

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

const PickerRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const PickerLabel = styled.span`
  color: ${({ theme }) => theme.colors.neutral800};
  font-size: 12px;
  font-weight: 600;
  line-height: 1.33;
`

const PickerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
`

const PickerOption = styled.button<{ $selected: boolean }>`
  align-items: center;
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primary100 : theme.colors.neutral0};
  border: 2px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary600 : theme.colors.neutral200};
  border-radius: 6px;
  color: ${({ $selected, theme }) =>
    $selected ? theme.colors.primary600 : theme.colors.neutral800};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-family: inherit;
  font-size: 11px;
  font-weight: ${({ $selected }) => ($selected ? 600 : 400)};
  gap: 8px;
  line-height: 1.3;
  padding: 14px 10px;
  text-align: center;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: 2px;
  }
`

const FieldMessage = styled.p<{ $error?: boolean }>`
  color: ${({ $error, theme }) =>
    $error ? theme.colors.danger600 : theme.colors.neutral600};
  font-size: 12px;
  margin: 0;
`

function idFromName(name: string, suffix: string): string {
  return `${name.replace(/[^A-Za-z0-9_-]+/g, '-')}-${suffix}`
}

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

const FIELD_LABELS: Record<string, string> = {
  imagePosition: 'Image position',
  image: 'Image',
  imageAlt: 'Image alt text',
  videoUrl: 'Video URL',
  content: 'Content',
  quote: 'Quote',
  quoteSource: 'Quote Attribution',
  cta: 'CTA'
}

function fieldNameFromPath(path: string): string {
  return path.split('.').pop() ?? path
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function findFieldAnchor(path: string, scope: ParentNode): HTMLElement | null {
  const direct = scope.querySelector<HTMLElement>(selectorsForPath(path))
  if (direct) return direct

  const label = FIELD_LABELS[fieldNameFromPath(path)]
  if (!label) return null

  return (
    Array.from(scope.querySelectorAll<HTMLElement>('label, legend')).find(
      (el) => normalizeText(el.textContent ?? '').startsWith(label)
    ) ?? null
  )
}

function findFieldContainer(
  path: string,
  scope: ParentNode
): HTMLElement | null {
  const anchor = findFieldAnchor(path, scope)
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

function setFieldVisibility(
  paths: string[],
  visible: boolean,
  scope: ParentNode
) {
  const containers = new Set<HTMLElement>()

  for (const path of paths) {
    const container = findFieldContainer(path, scope)
    if (container) containers.add(container)
  }

  for (const container of containers) {
    container.style.display = visible ? '' : 'none'
  }
}

function applyFieldVisibility(
  prefix: string,
  layoutType: string,
  scope: ParentNode
) {
  const showImage = layoutType.startsWith('image')
  const showVideo = layoutType.startsWith('video')
  const showText = layoutType.endsWith('-text')
  const showQuote = layoutType.endsWith('-quote')

  setFieldVisibility([`${prefix}.image`], showImage, scope)
  setFieldVisibility([`${prefix}.imageAlt`], showImage, scope)
  setFieldVisibility([`${prefix}.videoUrl`], showVideo, scope)
  setFieldVisibility([`${prefix}.content`], showText, scope)
  setFieldVisibility(
    [`${prefix}.quote`, `${prefix}.quoteSource`],
    showQuote,
    scope
  )
  setFieldVisibility(
    [
      `${prefix}.cta`,
      `${prefix}.cta.text`,
      `${prefix}.cta.link`,
      `${prefix}.cta.style`,
      `${prefix}.cta.external`
    ],
    showText,
    scope
  )
}

export default function SplitLayoutTypePicker({
  name,
  onChange,
  value,
  error,
  hint
}: InputProps) {
  const prefix = name.replace(/\.layoutType$/, '')
  const latestLayoutTypeRef = useRef(value)
  const visibilityFrameRef = useRef<number | null>(null)
  const labelId = idFromName(name, 'label')
  const hintId = idFromName(name, 'hint')
  const errorId = idFromName(name, 'error')
  const describedBy = error ? errorId : hint ? hintId : undefined

  const scheduleFieldVisibility = (layoutType: string) => {
    latestLayoutTypeRef.current = layoutType
    if (visibilityFrameRef.current !== null) {
      cancelAnimationFrame(visibilityFrameRef.current)
    }

    visibilityFrameRef.current = requestAnimationFrame(() => {
      visibilityFrameRef.current = null
      applyFieldVisibility(
        prefix,
        latestLayoutTypeRef.current ?? layoutType,
        document
      )
    })
  }

  const handleSelect = (newValue: LayoutType) => {
    onChange({ target: { name, value: newValue, type: 'string' } })
    scheduleFieldVisibility(newValue)
  }

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const horizontalDelta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0

    if (horizontalDelta !== 0) {
      event.preventDefault()
      const nextIndex =
        (index + horizontalDelta + LAYOUTS.length) % LAYOUTS.length
      const nextLayout = LAYOUTS[nextIndex].value
      handleSelect(nextLayout)
      event.currentTarget.parentElement
        ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
        [nextIndex]?.focus()
      return
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleSelect(LAYOUTS[index].value)
    }
  }

  useEffect(() => {
    if (!value) return
    latestLayoutTypeRef.current = value

    const scheduleApply = () => {
      scheduleFieldVisibility(latestLayoutTypeRef.current ?? value)
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
    <PickerRoot>
      <PickerLabel id={labelId}>Layout type</PickerLabel>
      <PickerGrid
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
      >
        {LAYOUTS.map((layout, index) => {
          const isSelected = value === layout.value
          return (
            <PickerOption
              key={layout.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (!value && index === 0) ? 0 : -1}
              $selected={isSelected}
              onClick={() => handleSelect(layout.value)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              {layout.icon}
              <span>{layout.label}</span>
            </PickerOption>
          )
        })}
      </PickerGrid>
      {hint && !error && <FieldMessage id={hintId}>{hint}</FieldMessage>}
      {error && (
        <FieldMessage id={errorId} $error>
          {error}
        </FieldMessage>
      )}
    </PickerRoot>
  )
}
