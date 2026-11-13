import { useField, useForm } from '@strapi/admin/strapi-admin'
import { Checkbox, Field } from '@strapi/design-system'

const DRAFT_FIELD = 'draft'
const DRAFT_FIELD_ID = 'draft-checkbox'
const GAP_BELOW_ACTIONS = '10px'

// Production builds drop drafts; see src/utils/main/gatedCollection.ts.
const DRAFT_HINT =
  'Enable this if the page is still a work in progress and should not be displayed in production.'

/**
 * The `draft` checkbox, rendered in the edit view's Entry panel below the
 * Publish button instead of in the main form (INTORG-1289). It writes to the
 * same form state the main form uses, so it saves with the rest of the entry.
 *
 * A plain checkbox rather than Strapi's boolean toggle: the toggle offers a
 * "Clear" option that sets the field to null, a third state that means nothing
 * here.
 */
export function DraftCheckbox() {
  const hasDraftField = useForm('DraftCheckbox', (state) => {
    if (!(DRAFT_FIELD in state.values)) return false
    const value: unknown = state.values[DRAFT_FIELD]
    return typeof value === 'boolean' || value == null
  })
  if (!hasDraftField) return null

  return <DraftCheckboxField />
}

function DraftCheckboxField() {
  const field = useField<boolean | null>(DRAFT_FIELD)
  const isDisabled = useForm('DraftCheckbox', (state) => state.isSubmitting)

  // Entries saved before the field existed hold null. Unticking restores that
  // null rather than writing false, so the form doesn't stay "modified" with
  // no visible change.
  const uncheckedValue = field.initialValue == null ? field.initialValue : false

  return (
    <Field.Root
      id={DRAFT_FIELD_ID}
      name={DRAFT_FIELD}
      hint={DRAFT_HINT}
      width="100%"
      style={{ marginTop: GAP_BELOW_ACTIONS }}
    >
      <Checkbox
        checked={field.value === true}
        disabled={isDisabled}
        aria-describedby={`${DRAFT_FIELD_ID}-hint`}
        onCheckedChange={(checked) =>
          field.onChange(DRAFT_FIELD, checked === true ? true : uncheckedValue)
        }
      >
        Draft
      </Checkbox>
      <Field.Hint />
    </Field.Root>
  )
}
