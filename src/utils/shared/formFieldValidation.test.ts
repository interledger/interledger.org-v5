import { describe, expect, it, vi } from 'vitest'
import {
  bindEmailFieldValidation,
  resolveEmailFieldErrorMessage,
  resolveRequiredFieldErrorMessage,
  revealFormError,
  setFieldInvalid,
  setSubmitButtonBusy,
  shouldSyncValidatedField,
  syncEmailFieldError
} from './formFieldValidation'
import { validity } from './formValidity.fixture'

const messages = { required: 'Required', invalid: 'Invalid email' }

/** Minimal DOMTokenList fake — real DOM isn't set up in this test environment. */
function createClassList(initial: string[] = []) {
  const classes = new Set(initial)
  return {
    add: (c: string) => classes.add(c),
    remove: (c: string) => classes.delete(c),
    toggle: (c: string, force?: boolean) => {
      const shouldHave = force ?? !classes.has(c)
      if (shouldHave) classes.add(c)
      else classes.delete(c)
      return shouldHave
    },
    contains: (c: string) => classes.has(c)
  } as unknown as DOMTokenList
}

function createErrorElement(id = 'field-error') {
  return {
    id,
    textContent: '',
    classList: createClassList(['hidden']),
    focus: vi.fn(),
    scrollIntoView: vi.fn()
  } as unknown as HTMLElement
}

function createInput(
  overrides: {
    value?: string
    dataset?: Record<string, string>
    validity?: Pick<ValidityState, 'valueMissing' | 'typeMismatch'>
  } = {}
) {
  const attributes = new Map<string, string>()
  return {
    value: overrides.value ?? '',
    dataset: overrides.dataset ?? {},
    validity: overrides.validity ?? validity({}),
    setAttribute: (name: string, val: string) => attributes.set(name, val),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    removeAttribute: (name: string) => attributes.delete(name),
    addEventListener: vi.fn()
  } as unknown as HTMLInputElement & {
    getAttribute: (name: string) => string | null
  }
}

function createButton(dataset: Record<string, string> = {}) {
  const attributes = new Map<string, string>()
  return {
    disabled: false,
    dataset,
    setAttribute: (name: string, val: string) => attributes.set(name, val),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    classList: createClassList()
  } as unknown as HTMLButtonElement & {
    getAttribute: (name: string) => string | null
  }
}

describe('resolveEmailFieldErrorMessage', () => {
  it('returns null for empty value before submit', () => {
    expect(
      resolveEmailFieldErrorMessage('   ', validity({}), messages, false)
    ).toBeNull()
  })

  it('returns required after submit when empty', () => {
    expect(
      resolveEmailFieldErrorMessage(
        '',
        validity({ valueMissing: true }),
        messages,
        true
      )
    ).toBe('Required')
  })

  it('returns invalid for malformed email once the field has content', () => {
    expect(
      resolveEmailFieldErrorMessage('abc', validity({}), messages, false)
    ).toBe('Invalid email')
  })

  it('returns null for a valid email', () => {
    expect(
      resolveEmailFieldErrorMessage(
        'user@example.com',
        validity({}),
        messages,
        false
      )
    ).toBeNull()
  })
})

describe('resolveRequiredFieldErrorMessage', () => {
  it('returns required message when value is missing', () => {
    expect(
      resolveRequiredFieldErrorMessage(
        validity({ valueMissing: true }),
        'Required'
      )
    ).toBe('Required')
  })

  it('returns null when the field is valid', () => {
    expect(
      resolveRequiredFieldErrorMessage(validity({}), 'Required')
    ).toBeNull()
  })
})

describe('shouldSyncValidatedField', () => {
  it('returns false for an untouched empty field', () => {
    expect(shouldSyncValidatedField('', false, false)).toBe(false)
  })

  it('returns true once the user has entered a value', () => {
    expect(shouldSyncValidatedField('abc', false, false)).toBe(true)
  })

  it('returns true while clearing a field that was marked invalid', () => {
    expect(shouldSyncValidatedField('', true, false)).toBe(true)
  })

  it('returns true after a submit attempt even when empty', () => {
    expect(shouldSyncValidatedField('', false, true)).toBe(true)
  })
})

describe('setFieldInvalid', () => {
  it('marks the field invalid and reveals the message', () => {
    const input = createInput()
    const errorEl = createErrorElement()

    const invalid = setFieldInvalid(input, errorEl, 'Required', 'help-id')

    expect(invalid).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(errorEl.textContent).toBe('Required')
    expect(errorEl.classList.contains('hidden')).toBe(false)
    expect(input.getAttribute('aria-describedby')).toBe('help-id field-error')
  })

  it('clears invalid state and hides the message when message is null', () => {
    const input = createInput()
    const errorEl = createErrorElement()

    const invalid = setFieldInvalid(input, errorEl, null, 'help-id')

    expect(invalid).toBe(false)
    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(errorEl.classList.contains('hidden')).toBe(true)
    expect(input.getAttribute('aria-describedby')).toBe('help-id')
  })

  it('removes aria-describedby entirely when there is no helpId or error', () => {
    const input = createInput()

    setFieldInvalid(input, null, null)

    expect(input.getAttribute('aria-describedby')).toBeNull()
  })
})

describe('syncEmailFieldError', () => {
  it('flags an invalid email and reveals the message', () => {
    const input = createInput({
      value: 'not-an-email',
      dataset: { errorRequired: 'Required', errorInvalid: 'Invalid email' }
    })
    const errorEl = createErrorElement()

    expect(syncEmailFieldError(input, errorEl, false)).toBe(true)
    expect(errorEl.textContent).toBe('Invalid email')
  })

  it('clears the error for a valid email', () => {
    const input = createInput({
      value: 'user@example.com',
      dataset: { errorRequired: 'Required', errorInvalid: 'Invalid email' }
    })
    const errorEl = createErrorElement()

    expect(syncEmailFieldError(input, errorEl, false)).toBe(false)
    expect(errorEl.classList.contains('hidden')).toBe(true)
  })

  it('trims surrounding whitespace and accepts the remaining address', () => {
    const input = createInput({
      value: '  user@example.com  ',
      dataset: { errorRequired: 'Required', errorInvalid: 'Invalid email' },
      validity: validity({ typeMismatch: true })
    })
    const errorEl = createErrorElement()

    expect(syncEmailFieldError(input, errorEl, false)).toBe(false)
    expect(input.value).toBe('user@example.com')
    expect(errorEl.classList.contains('hidden')).toBe(true)
  })
})

describe('bindEmailFieldValidation', () => {
  it('binds blur and input listeners', () => {
    const input = createInput()
    bindEmailFieldValidation({
      input,
      errorEl: null,
      getAttemptedSubmit: () => false
    })

    expect(input.addEventListener).toHaveBeenCalledWith(
      'blur',
      expect.any(Function)
    )
    expect(input.addEventListener).toHaveBeenCalledWith(
      'input',
      expect.any(Function)
    )
  })

  it('ignores an untouched empty field until submit is attempted', () => {
    const input = createInput({ value: '' })
    const errorEl = createErrorElement()
    bindEmailFieldValidation({
      input,
      errorEl,
      getAttemptedSubmit: () => false
    })

    const [, onInput] = vi
      .mocked(input.addEventListener)
      .mock.calls.find(([event]) => event === 'input') as [string, () => void]
    onInput()

    expect(errorEl.classList.contains('hidden')).toBe(true)
  })

  it('returned sync function re-validates on demand', () => {
    const input = createInput({
      value: 'bad',
      dataset: { errorRequired: 'Required', errorInvalid: 'Invalid email' }
    })
    const errorEl = createErrorElement()
    const sync = bindEmailFieldValidation({
      input,
      errorEl,
      getAttemptedSubmit: () => true
    })

    expect(sync()).toBe(true)
    expect(errorEl.textContent).toBe('Invalid email')
  })
})

describe('revealFormError', () => {
  it('does nothing for a missing element', () => {
    expect(() => revealFormError(null)).not.toThrow()
    expect(() => revealFormError(undefined)).not.toThrow()
  })

  it('unhides, focuses, and scrolls the element into view', () => {
    const errorEl = createErrorElement()

    revealFormError(errorEl)

    expect(errorEl.classList.contains('hidden')).toBe(false)
    expect(errorEl.focus).toHaveBeenCalled()
    expect(errorEl.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center'
    })
  })
})

describe('setSubmitButtonBusy', () => {
  it('does nothing for a missing button', () => {
    expect(() => setSubmitButtonBusy(null, null, true)).not.toThrow()
  })

  it('marks the button busy and swaps the label', () => {
    const submitBtn = createButton({
      labelDefault: 'Submit',
      labelBusy: 'Submitting…'
    })
    const submitLabel = { textContent: '' } as unknown as HTMLElement

    setSubmitButtonBusy(submitBtn, submitLabel, true)

    expect(submitBtn.disabled).toBe(true)
    expect(submitBtn.getAttribute('aria-busy')).toBe('true')
    expect(submitLabel.textContent).toBe('Submitting…')
    expect(submitBtn.classList.contains('opacity-70')).toBe(true)
  })

  it('restores the default label when no longer busy', () => {
    const submitBtn = createButton({
      labelDefault: 'Submit',
      labelBusy: 'Submitting…'
    })
    const submitLabel = { textContent: '' } as unknown as HTMLElement

    setSubmitButtonBusy(submitBtn, submitLabel, false)

    expect(submitBtn.disabled).toBe(false)
    expect(submitLabel.textContent).toBe('Submit')
    expect(submitBtn.classList.contains('opacity-70')).toBe(false)
  })
})
