import {
  ckeditorFieldToCompiledMarkdown,
  ckeditorFieldToParsedMarkdown,
  htmlToMarkdown,
  looksLikeHtmlField,
  serializeIntroProp,
  INLINE_BREAK_TAG,
  SerializerFieldError,
  type BlockIntroInput,
  type FieldError
} from '../../utils'

const MIN_ITEMS = 2

interface AgendaItem {
  time?: string
  activity?: string
  additionalInfo?: string
}

interface AgendaBlock {
  intro?: BlockIntroInput | null
  heading?: string
  items?: AgendaItem[]
}

interface SerializedAgendaItem {
  time: string
  activity: string
  additionalInfo?: string
}

type FieldPath = FieldError['path']

// heading and additionalInfo are CKEditor fields: a line break needs
// promoting or it's lost or rendered as literal text. additionalInfo renders
// via parseMarkdown (block mode), so both a <br/> and a hard Enter (a second
// <p>) promote to a paragraph break. heading renders via parseMarkdownInline,
// which never breaks on its own, so both promote to a markdown hard line
// break (`  \n`) instead, which inline mode renders as a real `<br>`.
// time and activity are plain strings, never CKEditor HTML — just trimmed,
// converting to markdown only if pasted HTML slips in.
function normalizeRichText(value: string | undefined): string {
  return value ? ckeditorFieldToParsedMarkdown(value) : ''
}

const PARAGRAPH_BREAK = /\n{2,}/g

function normalizeHeading(value: string | undefined): string {
  if (!value) return ''
  return ckeditorFieldToCompiledMarkdown(value)
    .replace(INLINE_BREAK_TAG, '  \n')
    .replace(PARAGRAPH_BREAK, '  \n')
    .trim()
}

function normalizePlainText(value: string | undefined): string {
  if (!value) return ''
  return (looksLikeHtmlField(value) ? htmlToMarkdown(value) : value).trim()
}

/** Normalizes the items, pushing an error for each missing field. */
function serializeItems(
  items: AgendaItem[] | undefined,
  fieldErrors: FieldError[]
): SerializedAgendaItem[] {
  const path: FieldPath = ['items']
  if (!items || items.length < MIN_ITEMS) {
    fieldErrors.push({
      path,
      message: `Agenda block requires at least ${MIN_ITEMS} items`
    })
  }

  return (items ?? []).map((item, index) => {
    const time = normalizePlainText(item.time)
    const activity = normalizePlainText(item.activity)
    const additionalInfo = normalizeRichText(item.additionalInfo)

    if (!time) {
      fieldErrors.push({
        path: [...path, index, 'time'],
        message: `Agenda item ${index + 1} is missing a time`
      })
    }
    if (!activity) {
      fieldErrors.push({
        path: [...path, index, 'activity'],
        message: `Agenda item ${index + 1} is missing an activity`
      })
    }

    return additionalInfo
      ? { time, activity, additionalInfo }
      : { time, activity }
  })
}

export function serialize(block: AgendaBlock): string {
  const fieldErrors: FieldError[] = []
  const items = serializeItems(block.items, fieldErrors)
  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  const introAttr = serializeIntroProp(block.intro)
  const heading = normalizeHeading(block.heading)
  const headingAttr = heading ? ` heading={${JSON.stringify(heading)}}` : ''
  return `<Agenda${introAttr}${headingAttr} items={${JSON.stringify(items)}} />`
}
