/**
 * A Fundraise Up element id is `#` plus eight uppercase letters or digits
 * (`#XVSHSPQU`). Their script turns an anchor with that href into the donate
 * modal. A normal in-page link is lowercase words, so the two do not overlap.
 */
const ELEMENT_HREF = /^#[A-Z0-9]{8}$/

export function isFundraiseUpElementHref(href: string): boolean {
  return ELEMENT_HREF.test(href)
}
