/**
 * A Fundraise Up element id is `#` plus eight uppercase letters or digits
 * (`#XVSHSPQU`). Their script turns an anchor with that href into the donate
 * modal. A normal in-page link is lowercase words, so the two do not overlap.
 */
const ELEMENT_HREF = /^#[A-Z0-9]{8}$/
const ELEMENT_IN_TEXT = /#[A-Z0-9]{8}\b/

export function isFundraiseUpElementHref(href: string): boolean {
  return ELEMENT_HREF.test(href)
}

/** True when a page body or a Strapi block tree contains an element id. */
export function hasFundraiseUpElementId(value: unknown): boolean {
  if (typeof value === 'string') return ELEMENT_IN_TEXT.test(value)
  if (Array.isArray(value)) return value.some(hasFundraiseUpElementId)
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some(hasFundraiseUpElementId)
  }
  return false
}
