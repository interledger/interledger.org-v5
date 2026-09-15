import {
  ckeditorFieldToCompiledMarkdown,
  getImageUrl,
  hasMediaValue,
  SerializerFieldError,
  type FieldError
} from '../../utils'
import { escDouble as esc, escMdxBraces } from '../shared'

type ImageField = { url?: string; alternativeText?: string } | number

interface LocalizedMediaField {
  image?: ImageField
  alternativeText?: string | null
}

interface InternalAdvertBlock {
  helperText?: string
  logo?: LocalizedMediaField
  logoLabel?: string
  headline?: string
  body?: string
  socialLinks?: { url?: string }[]
  buttonText?: string
  buttonLink?: string
  buttonExternal?: boolean
  buttonDocument?: boolean
}

/**
 * The card needs enough on it to be worth interrupting the article for. Both
 * numbers come from the ticket (INTORG-824).
 */
const MIN_ELEMENTS = 3
const TOTAL_ELEMENTS = 6

function asMediaObject(field: ImageField | undefined) {
  return typeof field === 'object' ? field : undefined
}

/**
 * Serialize blocks.internal-advert → MDX.
 *
 * Every field is optional on its own, so the rules that make the card coherent
 * are cross-field and cannot live in the schema JSON. They are enforced here,
 * which is the edit-time gate: `serializeContent` turns what this throws into a
 * Strapi ValidationError against the right field path, so an editor sees the
 * problem on save rather than on the next export.
 */
export function serialize(block: InternalAdvertBlock): string {
  const hasLogo = Boolean(block.logo && hasMediaValue(block.logo.image))
  const hasHeadline = Boolean(block.headline?.trim())
  const body = block.body
    ? escMdxBraces(ckeditorFieldToCompiledMarkdown(block.body))
    : ''
  const hasBody = Boolean(body)

  // Both halves or neither: a label with no href is dead, an href with no
  // label is unreadable (same rule as CTA Strip).
  const hasButton = Boolean(
    block.buttonText?.trim() && block.buttonLink?.trim()
  )

  const socialUrls = (block.socialLinks ?? [])
    .map((link) => link?.url?.trim())
    .filter((url): url is string => Boolean(url))

  const presentElements = [
    Boolean(block.helperText?.trim()),
    hasLogo || Boolean(block.logoLabel?.trim()),
    hasHeadline,
    hasBody,
    socialUrls.length > 0,
    hasButton
  ].filter(Boolean).length

  const fieldErrors: FieldError[] = []

  if (!hasHeadline && !hasBody) {
    fieldErrors.push({
      path: ['headline'],
      message:
        'Internal Advert needs a headline or a body. Everything else on the card is furniture around those two.'
    })
  }

  if (presentElements < MIN_ELEMENTS) {
    fieldErrors.push({
      path: ['helperText'],
      message: `Internal Advert needs at least ${MIN_ELEMENTS} of its ${TOTAL_ELEMENTS} elements filled in. It has ${presentElements}.`
    })
  }

  if (block.buttonExternal && block.buttonDocument) {
    fieldErrors.push({
      path: ['buttonExternal'],
      message:
        'Internal Advert button cannot be both external and document. Pick one: external opens a new tab, document downloads a file.'
    })
  }

  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  const logoImage = hasLogo ? asMediaObject(block.logo!.image) : undefined
  const logoSrc = getImageUrl(logoImage)
  const logoAlt = hasLogo
    ? (block.logo!.alternativeText ?? logoImage?.alternativeText ?? '')
    : ''

  const attrs = [
    block.helperText?.trim()
      ? `helperText="${esc(block.helperText.trim())}"`
      : null,
    logoSrc ? `logo="${esc(logoSrc)}"` : null,
    // Emitted even when empty: a blank alt is a decision (the label beside the
    // logo already names it), and dropping the attribute would make the
    // re-import look like the editor never set one.
    logoSrc ? `logoAlt="${esc(logoAlt)}"` : null,
    block.logoLabel?.trim()
      ? `logoLabel="${esc(block.logoLabel.trim())}"`
      : null,
    hasHeadline ? `headline="${esc(block.headline!.trim())}"` : null,
    socialUrls.length > 0
      ? `socialLinks={[${socialUrls.map((url) => `"${esc(url)}"`).join(', ')}]}`
      : null,
    hasButton ? `buttonText="${esc(block.buttonText!.trim())}"` : null,
    hasButton ? `buttonLink="${esc(block.buttonLink!.trim())}"` : null,
    // The flags follow the button they belong to. A dropped button must not
    // leave its flags behind.
    hasButton && block.buttonExternal ? 'buttonExternal={true}' : null,
    hasButton && block.buttonDocument ? 'buttonDocument={true}' : null
  ]
    .filter(Boolean)
    .join(' ')

  // Blank line is load-bearing: Prettier ignores proseWrap for JSX children
  // flush against tags, but respects it once they're a real paragraph
  // (INTORG-1188).
  return hasBody
    ? `<InternalAdvert ${attrs}>\n\n${body}\n\n</InternalAdvert>`
    : `<InternalAdvert ${attrs} />`
}
