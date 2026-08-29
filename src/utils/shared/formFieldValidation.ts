import {
  constraintErrorKind,
  emailConstraintErrorKind
} from './formConstraints'

export function resolveEmailFieldErrorMessage(
  value: string,
  validity: Pick<ValidityState, 'valueMissing' | 'typeMismatch'>,
  messages: { required: string; invalid: string },
  attemptedSubmit: boolean
): string | null {
  const kind = emailConstraintErrorKind(value, validity)
  if (kind === 'required') return attemptedSubmit ? messages.required : null
  if (kind === 'invalid') return messages.invalid
  return null
}

export function resolveRequiredFieldErrorMessage(
  validity: Pick<ValidityState, 'valueMissing' | 'typeMismatch'>,
  requiredMessage: string
): string | null {
  return constraintErrorKind(validity) === 'required' ? requiredMessage : null
}

/** When to re-run field validation without waiting for submit. */
export function shouldSyncValidatedField(
  value: string,
  ariaInvalid: boolean,
  attemptedSubmit: boolean
): boolean {
  return attemptedSubmit || value !== '' || ariaInvalid
}

export function setFieldInvalid(
  input: HTMLInputElement | HTMLTextAreaElement,
  errorEl: HTMLElement | null,
  message: string | null,
  helpId?: string
): boolean {
  const invalid = Boolean(message)
  input.setAttribute('aria-invalid', invalid ? 'true' : 'false')
  if (errorEl) {
    if (message) errorEl.textContent = message
    errorEl.classList.toggle('hidden', !invalid)
  }
  const describedBy = [helpId, invalid ? errorEl?.id : null]
    .filter(Boolean)
    .join(' ')
  if (describedBy) {
    input.setAttribute('aria-describedby', describedBy)
  } else {
    input.removeAttribute('aria-describedby')
  }
  return invalid
}

export function syncEmailFieldError(
  input: HTMLInputElement,
  errorEl: HTMLElement | null,
  attemptedSubmit: boolean,
  helpId?: string
): boolean {
  const message = resolveEmailFieldErrorMessage(
    input.value,
    input.validity,
    {
      required: input.dataset.errorRequired ?? '',
      invalid: input.dataset.errorInvalid ?? ''
    },
    attemptedSubmit
  )
  return setFieldInvalid(input, errorEl, message, helpId)
}

export function bindEmailFieldValidation(options: {
  input: HTMLInputElement
  errorEl: HTMLElement | null
  getAttemptedSubmit: () => boolean
  helpId?: string
}): () => boolean {
  const { input, errorEl, getAttemptedSubmit, helpId } = options

  const sync = () =>
    syncEmailFieldError(input, errorEl, getAttemptedSubmit(), helpId)

  const maybeSync = () => {
    if (
      shouldSyncValidatedField(
        input.value,
        input.getAttribute('aria-invalid') === 'true',
        getAttemptedSubmit()
      )
    ) {
      sync()
    }
  }

  input.addEventListener('blur', maybeSync)
  input.addEventListener('input', maybeSync)

  return sync
}

export function revealFormError(el: HTMLElement | null | undefined): void {
  if (!el) return
  el.classList.remove('hidden')
  el.focus()
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function setSubmitButtonBusy(
  submitBtn: HTMLButtonElement | null,
  submitLabel: HTMLElement | null,
  busy: boolean
): void {
  if (!submitBtn) return
  submitBtn.disabled = busy
  submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false')
  const defaultLabel = submitBtn.dataset.labelDefault ?? ''
  const busyLabel = submitBtn.dataset.labelBusy ?? defaultLabel
  if (submitLabel) {
    submitLabel.textContent = busy ? busyLabel : defaultLabel
  }
  submitBtn.classList.toggle('opacity-70', busy)
  submitBtn.classList.toggle('pointer-events-none', busy)
}
