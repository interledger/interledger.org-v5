import { useField, useForm } from '@strapi/admin/strapi-admin'
import { Checkbox, Field } from '@strapi/design-system'

const DRAFT_FIELD = 'draft'

// Production builds drop drafts; see src/utils/main/gatedCollection.ts.
const DRAFT_HINT =
  'Enable this if the page is still a work in progress and should not be displayed in production.'

/**
 * The `draft` checkbox, rendered in the edit view's Publish panel next to the
 * action buttons instead of in the main form (INTORG-1289). It writes to the
 * same form state the main form uses, so it saves with the rest of the entry.
 *
 * A plain checkbox rather than Strapi's boolean toggle: the toggle offers a
 * "Clear" option that sets the field to null, a third state that means nothing
 * here.
 */
export function DraftCheckbox() {
  const hasDraftField = useForm(
    'DraftCheckbox',
    (state) => DRAFT_FIELD in state.values
  )
  if (!hasDraftField) return null

  return <DraftCheckboxField />
}

function DraftCheckboxField() {
  const field = useField<boolean | null>(DRAFT_FIELD)
  const isDisabled = useForm('DraftCheckbox', (state) => state.isSubmitting)

  return (
    <Field.Root name={DRAFT_FIELD} hint={DRAFT_HINT} width="100%">
      <Checkbox
        checked={field.value === true}
        disabled={isDisabled}
        onCheckedChange={(checked) =>
          field.onChange(DRAFT_FIELD, checked === true)
        }
      >
        Draft
      </Checkbox>
      <Field.Hint />
    </Field.Root>
  )
}
