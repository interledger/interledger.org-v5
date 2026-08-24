const LINE_CLAMP_CLASS = 'line-clamp-2'
const OVERFLOW_TOLERANCE_PX = 1

function descriptionOverflows(el: HTMLElement): boolean {
  return el.scrollHeight - el.clientHeight > OVERFLOW_TOLERANCE_PX
}

function queryDescription(
  root: HTMLElement
): { text: HTMLElement; toggle: HTMLButtonElement } | null {
  const text = root.querySelector<HTMLElement>(
    '[data-grantee-description-text]'
  )
  const toggle = root.querySelector<HTMLButtonElement>(
    '[data-grantee-description-toggle]'
  )
  if (!text || !toggle) return null
  return { text, toggle }
}

function isExpanded(toggle: HTMLButtonElement): boolean {
  return toggle.getAttribute('aria-expanded') === 'true'
}

function setExpanded(root: HTMLElement, expanded: boolean) {
  const parts = queryDescription(root)
  if (!parts) return

  parts.text.classList.toggle(LINE_CLAMP_CLASS, !expanded)
  parts.toggle.setAttribute('aria-expanded', String(expanded))
  parts.toggle.hidden = false

  const label = parts.toggle.querySelector(
    '[data-grantee-description-toggle-label]'
  )
  const more = parts.toggle.dataset.labelMore
  const less = parts.toggle.dataset.labelLess
  if (label && more && less) {
    label.textContent = expanded ? less : more
  }
}

function syncToggle(root: HTMLElement) {
  const parts = queryDescription(root)
  if (!parts) return
  if (isExpanded(parts.toggle)) return
  parts.toggle.hidden = !descriptionOverflows(parts.text)
}

function bindDescription(root: HTMLElement) {
  if (root.dataset.granteeDescriptionReady === 'true') return
  root.dataset.granteeDescriptionReady = 'true'

  const parts = queryDescription(root)
  if (!parts) return

  parts.toggle.addEventListener('click', () => {
    setExpanded(root, !isExpanded(parts.toggle))
  })

  const reveal = () => syncToggle(root)
  reveal()
  void document.fonts?.ready.then(reveal)

  const observer = new ResizeObserver(reveal)
  observer.observe(parts.text)
}

export function initGranteeDescriptions(scope: ParentNode = document) {
  scope
    .querySelectorAll<HTMLElement>('[data-grantee-description]')
    .forEach(bindDescription)
}

initGranteeDescriptions()
