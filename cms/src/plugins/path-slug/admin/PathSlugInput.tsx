import { useState } from 'react'
import type { FocusEventHandler, ReactNode } from 'react'
import { useFocusInputField } from '@strapi/admin/strapi-admin'
import { Field, TextInput } from '@strapi/design-system'
import {
  pathSlugOnBlur,
  visiblePathSlugError
} from '../../../utils/pathSlugField'

interface PathSlugInputProps {
  name: string
  onChange: (event: {
    target: { name: string; value: string; type?: string }
  }) => void
  onBlur?: FocusEventHandler<HTMLInputElement>
  onFocus?: FocusEventHandler<HTMLInputElement>
  value?: string | null
  error?: string
  hint?: ReactNode
  label?: ReactNode
  labelAction?: ReactNode
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

/**
 * Path Slug. A custom input, so a slug is corrected when the editor leaves
 * the field (`About Us` → `/about-us/`) and what can't be corrected is named
 * before they save.
 */
export default function PathSlugInput({
  name,
  onChange,
  onBlur,
  onFocus,
  value,
  error,
  hint,
  label,
  labelAction,
  required,
  disabled,
  placeholder
}: PathSlugInputProps) {
  const [touched, setTouched] = useState(false)
  const fieldRef = useFocusInputField<HTMLInputElement>(name)
  const shownError = visiblePathSlugError(value, error, touched)

  return (
    <Field.Root error={shownError} name={name} hint={hint} required={required}>
      <Field.Label action={labelAction}>{label}</Field.Label>
      <TextInput
        ref={fieldRef}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        type="text"
        value={value ?? ''}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={(event) => {
          setTouched(true)
          const corrected = pathSlugOnBlur(value)
          if (corrected !== undefined) {
            onChange({ target: { name, value: corrected, type: 'text' } })
          }
          onBlur?.(event)
        }}
      />
      <Field.Hint />
      <Field.Error />
    </Field.Root>
  )
}
