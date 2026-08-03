import { useEffect } from 'react'
import { useForm } from '@strapi/admin/strapi-admin'
import { isCardVariant, type CardVariant } from './variantLabels'
import { VARIANTS } from './variantIcons'

interface InputProps {
  name: string
  onChange: (event: {
    target: { name: string; value: string; type: string }
  }) => void
  value?: string
  error?: string
  hint?: string
}

const VARIANT_FIELD: Record<CardVariant, string> = {
  Title: 'titleCards',
  Resource: 'resourceCards',
  Info: 'infoCards',
  Navigation: 'navigationCards'
}

const CARD_FIELDS = Object.values(VARIANT_FIELD)

const FIELD_LABEL: Record<string, string> = {
  titleCards: 'Title cards',
  resourceCards: 'Resource cards',
  infoCards: 'Info cards',
  navigationCards: 'Navigation cards'
}

function normalizeFieldText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Strapi appends " (n)" to repeatable component legends — match the base label. */
function labelMatchesField(el: HTMLElement, fieldKey: string): boolean {
  const text = normalizeFieldText(el.textContent ?? '')
  const expected = FIELD_LABEL[fieldKey]
  return text === expected || text.startsWith(`${expected} (`)
}

function fieldPresentIn(
  prefix: string,
  fieldKey: string,
  root: ParentNode
): boolean {
  if (root.querySelector(`[name^="${prefix}.${fieldKey}"]`)) return true
  if (root.querySelector(`[id="${prefix}.${fieldKey}-hint"]`)) return true
  return Array.from(root.querySelectorAll<HTMLElement>('label, legend')).some(
    (el) => labelMatchesField(el, fieldKey)
  )
}

function countCardFieldsWithin(prefix: string, ancestor: HTMLElement): number {
  return CARD_FIELDS.filter((fieldKey) =>
    fieldPresentIn(prefix, fieldKey, ancestor)
  ).length
}

/**
 * Ancestor that owns this Card Grid instance's fields. Scopes label lookups so
 * a second Card Grid on the same page doesn't steal matches.
 */
function findCardGridRoot(prefix: string): HTMLElement | null {
  const anchor = document.querySelector<HTMLElement>(
    `[name="${prefix}.ariaLabel"], [name="${prefix}.columns"]`
  )
  if (!anchor) return null

  let node: HTMLElement = anchor
  for (let level = 0; level < 20; level++) {
    const parent = node.parentElement
    if (!parent) break
    if (countCardFieldsWithin(prefix, parent) >= CARD_FIELDS.length) {
      return parent
    }
    node = parent
  }
  return node
}

function findFieldAnchor(
  prefix: string,
  fieldKey: string,
  root: ParentNode
): HTMLElement | null {
  const byName = root.querySelector<HTMLElement>(
    `[name^="${prefix}.${fieldKey}"]`
  )
  if (byName) return byName

  const hint = root.querySelector<HTMLElement>(
    `[id="${prefix}.${fieldKey}-hint"]`
  )
  if (hint) return hint

  return (
    Array.from(root.querySelectorAll<HTMLElement>('label, legend')).find((el) =>
      labelMatchesField(el, fieldKey)
    ) ?? null
  )
}

/**
 * Walk up from a field anchor only as far as the ancestor still contains
 * exactly this one card field. Same approach as SplitLayoutTypePicker.
 */
function findFieldContainer(
  prefix: string,
  fieldKey: string,
  root: HTMLElement
): HTMLElement | null {
  const anchor = findFieldAnchor(prefix, fieldKey, root)
  if (!anchor) return null

  let node: HTMLElement = anchor
  for (let level = 0; level < 15; level++) {
    const parent = node.parentElement
    if (!parent || parent === root.parentElement) break
    if (countCardFieldsWithin(prefix, parent) > 1) return node
    node = parent
  }
  return node
}

function applyCardFieldVisibility(prefix: string, variant: string) {
  const active = VARIANT_FIELD[variant as CardVariant]
  if (!active) return

  const root = findCardGridRoot(prefix) ?? document.body
  for (const fieldKey of CARD_FIELDS) {
    const container = findFieldContainer(prefix, fieldKey, root)
    if (!container) continue
    // Bail if we resolved a shared wrapper — hiding it would conceal every
    // card section, including the active one the editor needs to fill.
    if (countCardFieldsWithin(prefix, container) > 1) continue
    container.style.display = fieldKey === active ? '' : 'none'
  }
}

function clearInactiveCardFields(
  prefix: string,
  variant: CardVariant,
  setFieldValue: (path: string, value: unknown) => void
) {
  const active = VARIANT_FIELD[variant]
  for (const fieldKey of CARD_FIELDS) {
    if (fieldKey !== active) {
      setFieldValue(`${prefix}.${fieldKey}`, [])
    }
  }
}

export default function CardVariantPicker({
  name,
  onChange,
  value,
  error,
  hint
}: InputProps) {
  const prefix = name.endsWith('.variant')
    ? name.slice(0, -'.variant'.length)
    : name.replace(/\.variant$/, '')
  const setFieldValue = useForm('CardVariantPicker', (form) => form.onChange)

  const handleSelect = (newValue: CardVariant) => {
    onChange({ target: { name, value: newValue, type: 'string' } })
    // Only clear on explicit variant change — never on mount/remount, which
    // raced form hydration and could wipe cards the editor just added.
    clearInactiveCardFields(prefix, newValue, setFieldValue)
    requestAnimationFrame(() => applyCardFieldVisibility(prefix, newValue))
  }

  useEffect(() => {
    if (!value || !isCardVariant(value)) return

    let debounceId: ReturnType<typeof setTimeout> | undefined
    const apply = () => applyCardFieldVisibility(prefix, value)
    const schedule = () => {
      clearTimeout(debounceId)
      debounceId = setTimeout(apply, 50)
    }

    const timeoutId = setTimeout(apply, 80)

    // Strapi re-renders repeatable fields when entries are added/removed;
    // re-apply so inactive sections stay hidden.
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(debounceId)
      observer.disconnect()
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
        {VARIANTS.map((variant) => {
          const isSelected = value === variant.value
          return (
            <button
              key={variant.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelect(variant.value)}
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
              {variant.icon}
              <span>{variant.label}</span>
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
