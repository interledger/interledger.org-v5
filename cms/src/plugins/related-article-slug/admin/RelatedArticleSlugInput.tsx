import { useState } from 'react'
import type { FocusEventHandler, ReactNode } from 'react'
import { useFocusInputField } from '@strapi/admin/strapi-admin'
import { Field, TextInput } from '@strapi/design-system'
import { visibleRelatedArticleSlugError } from '../../../utils/relatedArticleSlug'

interface RelatedArticleSlugInputProps {
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
 * Related Post Slug. A custom input, so we can show our own message when
 * the value is not a `/blog/` path.
 */
export default function RelatedArticleSlugInput({
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
}: RelatedArticleSlugInputProps) {
  const [touched, setTouched] = useState(false)
  const fieldRef = useFocusInputField<HTMLInputElement>(name)
  const shownError = visibleRelatedArticleSlugError(value, error, touched)

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
          onBlur?.(event)
        }}
      />
      <Field.Hint />
      <Field.Error />
    </Field.Root>
  )
}
