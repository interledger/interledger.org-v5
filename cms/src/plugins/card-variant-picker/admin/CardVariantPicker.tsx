import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useForm } from '@strapi/admin/strapi-admin'
import { isCardVariant, type CardVariant } from './variantLabels'
import { VARIANTS } from './variantIcons'
import {
  CARD_GRID_FIELD_LABELS,
  CARD_GRID_VARIANT_FIELDS,
  CARD_GRID_VARIANTS,
  getAllowedCardGridVariants,
  type CardGridCardsField
} from '../../../utils/cardGrid'

interface InputProps {
  name: string
  onChange: (event: {
    target: { name: string; value: string; type: string }
  }) => void
  value?: string
  error?: string
  hint?: string
}

const VARIANT_SUFFIX = '.variant'

/** Every card repeatable on the schema — used to show/hide/clear inactive ones. */
const ALL_CARD_FIELDS: CardGridCardsField[] = CARD_GRID_VARIANTS.map(
  (variant) => CARD_GRID_VARIANT_FIELDS[variant]
)

/**
 * Content-manager URLs look like:
 * /admin/content-manager/collection-types/api::grant-page.grant-page/...
 * Returns null when the UID can't be resolved (modals, custom views, route
 * changes). Callers must fail closed — never unlock every variant in that case.
 */
function getContentTypeUidFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const match = window.location.pathname.match(
    /content-manager\/(?:collection|single)-types\/(api::[^/]+)/
  )
  return match?.[1] ?? null
}

function normalizeFieldText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Strapi appends " (n)" to repeatable component legends — match the base label. */
function labelMatchesField(
  el: HTMLElement,
  fieldKey: CardGridCardsField
): boolean {
  const text = normalizeFieldText(el.textContent ?? '')
  const expected = CARD_GRID_FIELD_LABELS[fieldKey]
  return text === expected || text.startsWith(`${expected} (`)
}

function fieldPresentIn(
  prefix: string,
  fieldKey: CardGridCardsField,
  root: ParentNode
): boolean {
  if (root.querySelector(`[name^="${prefix}.${fieldKey}"]`)) return true
  if (root.querySelector(`[id="${prefix}.${fieldKey}-hint"]`)) return true
  return Array.from(root.querySelectorAll<HTMLElement>('label, legend')).some(
    (el) => labelMatchesField(el, fieldKey)
  )
}

function countCardFieldsWithin(
  prefix: string,
  ancestor: HTMLElement,
  cardFields: CardGridCardsField[]
): number {
  return cardFields.filter((fieldKey) =>
    fieldPresentIn(prefix, fieldKey, ancestor)
  ).length
}

/**
 * Ancestor that owns this Card Grid instance's fields. Scopes label lookups so
 * a second Card Grid on the same page doesn't steal matches.
 */
function findCardGridRoot(
  prefix: string,
  cardFields: CardGridCardsField[]
): HTMLElement | null {
  const anchor = document.querySelector<HTMLElement>(
    `[name="${prefix}.ariaLabel"], [name="${prefix}.columns"]`
  )
  if (!anchor) return null

  let node: HTMLElement = anchor
  for (let level = 0; level < 20; level++) {
    const parent = node.parentElement
    if (!parent) break
    if (
      countCardFieldsWithin(prefix, parent, cardFields) >= cardFields.length
    ) {
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
      labelMatchesField(el, fieldKey as CardGridCardsField)
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
  root: HTMLElement,
  cardFields: CardGridCardsField[]
): HTMLElement | null {
  const anchor = findFieldAnchor(prefix, fieldKey, root)
  if (!anchor) return null

  let node: HTMLElement = anchor
  for (let level = 0; level < 15; level++) {
    const parent = node.parentElement
    if (!parent || parent === root.parentElement) break
    if (countCardFieldsWithin(prefix, parent, cardFields) > 1) return node
    node = parent
  }
  return node
}

function applyCardFieldVisibility(
  prefix: string,
  variant: string,
  cardFields: CardGridCardsField[]
) {
  const active = CARD_GRID_VARIANT_FIELDS[variant as CardVariant]
  if (!active) return

  // No unscoped document.body fallback: an unresolved root means this
  // instance's DOM hasn't painted yet (e.g. a just-added dynamic-zone block).
  // Falling back to document.body would let the label-text matching in
  // findFieldAnchor resolve to a DIFFERENT Card Grid instance on the same
  // page. Skip this pass; the mount timeouts and MutationObserver retry it.
  const root = findCardGridRoot(prefix, cardFields)
  if (!root) return

  for (const fieldKey of cardFields) {
    const container = findFieldContainer(prefix, fieldKey, root, cardFields)
    if (!container) continue
    // Bail if we resolved a shared wrapper — hiding it would conceal every
    // card section, including the active one the editor needs to fill.
    if (countCardFieldsWithin(prefix, container, cardFields) > 1) continue
    container.style.display = fieldKey === active ? '' : 'none'
  }
}

function clearInactiveCardFields(
  prefix: string,
  variant: CardVariant,
  cardFields: CardGridCardsField[],
  setFieldValue: (path: string, value: unknown) => void
) {
  const active = CARD_GRID_VARIANT_FIELDS[variant]
  for (const fieldKey of cardFields) {
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
  const prefix = name.endsWith(VARIANT_SUFFIX)
    ? name.slice(0, -VARIANT_SUFFIX.length)
    : name
  const setFieldValue = useForm('CardVariantPicker', (form) => form.onChange)

  // Content-type detection must react to SPA navigation: the content-manager
  // edit view is a single route (`:collectionType/:slug/:id`) with no remount
  // key on `:slug`, so navigating between two different content types' edit
  // pages can reuse this mounted instance — recompute on pathname change
  // rather than baking in whatever the URL was at first mount.
  const location = useLocation()
  const contentTypeUid = useMemo(
    () => getContentTypeUidFromLocation(),
    [location.pathname]
  )
  // Fail closed when the content-type UID can't be parsed from the URL.
  // getAllowedCardGridVariants(null) returns every variant (used by MDX /
  // server paths with no UID); the admin picker must not unlock restricted
  // types (e.g. grant → Info only) just because the route shape differs.
  const allowedVariants = useMemo(
    () => (contentTypeUid ? getAllowedCardGridVariants(contentTypeUid) : []),
    [contentTypeUid]
  )
  const uidResolved = contentTypeUid !== null
  const pickerVariants = useMemo(
    () => VARIANTS.filter((variant) => allowedVariants.includes(variant.value)),
    [allowedVariants]
  )
  // Always walk every schema field so Title/Resource/Navigation can be hidden
  // on grant pages even when only Info is allowed in the picker.
  const cardFields = ALL_CARD_FIELDS
  const singleVariant =
    allowedVariants.length === 1 ? allowedVariants[0]! : null

  const handleSelect = (newValue: CardVariant) => {
    if (!allowedVariants.includes(newValue)) return
    onChange({ target: { name, value: newValue, type: 'string' } })
    // Only clear on explicit variant change — never on mount/remount, which
    // raced form hydration and could wipe cards the editor just added.
    clearInactiveCardFields(prefix, newValue, cardFields, setFieldValue)
    requestAnimationFrame(() =>
      applyCardFieldVisibility(prefix, newValue, cardFields)
    )
  }

  // Restricted content types: force the only allowed variant when empty/wrong,
  // and clear disallowed card arrays so they don't linger in the form.
  useEffect(() => {
    if (!singleVariant) return
    if (value !== singleVariant) {
      onChange({ target: { name, value: singleVariant, type: 'string' } })
    }
    clearInactiveCardFields(prefix, singleVariant, cardFields, setFieldValue)
    requestAnimationFrame(() =>
      applyCardFieldVisibility(prefix, singleVariant, cardFields)
    )
  }, [singleVariant, value, name, prefix, cardFields, onChange, setFieldValue])

  useEffect(() => {
    const activeVariant =
      value && isCardVariant(value) && allowedVariants.includes(value)
        ? value
        : singleVariant
    if (!activeVariant) return

    let debounceId: ReturnType<typeof setTimeout> | undefined
    const apply = () =>
      applyCardFieldVisibility(prefix, activeVariant, cardFields)
    const schedule = () => {
      clearTimeout(debounceId)
      debounceId = setTimeout(apply, 50)
    }

    // Apply ASAP, then again after Strapi finishes painting repeatable fields.
    const timeoutId = setTimeout(apply, 80)
    const timeoutId2 = setTimeout(apply, 250)

    // Strapi re-renders repeatable fields when entries are added/removed;
    // re-apply so inactive sections stay hidden.
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(timeoutId2)
      clearTimeout(debounceId)
      observer.disconnect()
    }
  }, [value, prefix, allowedVariants, singleVariant, cardFields])

  // Unknown content type: block editing instead of offering every variant.
  if (!uidResolved || allowedVariants.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ fontSize: '12px', color: '#D02B20', margin: 0 }}>
          Card variant cannot be changed here because the content type could not
          be determined. Open this entry in the content manager to edit the
          variant.
        </p>
        {error && (
          <p style={{ fontSize: '12px', color: '#D02B20', margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  // One allowed variant: no picker UI (variant is forced in the effect above).
  // Return nothing so no helper copy appears under the field.
  if (singleVariant) {
    if (error) {
      return (
        <p style={{ fontSize: '12px', color: '#D02B20', margin: 0 }}>{error}</p>
      )
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(pickerVariants.length, 4)}, 1fr)`,
          gap: '10px'
        }}
      >
        {pickerVariants.map((variant) => {
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
