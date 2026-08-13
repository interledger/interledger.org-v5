import {
  htmlFieldToMarkdown,
  SerializerFieldError,
  type FieldError
} from '../../utils'

const MIN_ITEMS = 2

interface AgendaItem {
  time?: string
  activity?: string
  additionalInfo?: string
}

interface AgendaBlock {
  heading?: string
  items?: AgendaItem[]
}

function normalizeRichText(value: string | undefined): string {
  return value ? htmlFieldToMarkdown(value).trim() : ''
}

export function serialize(block: AgendaBlock): string {
  const fieldErrors: FieldError[] = []

  if (!block.items || block.items.length < MIN_ITEMS) {
    fieldErrors.push({
      path: ['items'],
      message: `Agenda block requires at least ${MIN_ITEMS} items`
    })
  }

  const items = (block.items ?? []).map((item, index) => {
    const time = normalizeRichText(item.time)
    const activity = normalizeRichText(item.activity)
    const additionalInfo = normalizeRichText(item.additionalInfo)

    if (!time) {
      fieldErrors.push({
        path: ['items', index, 'time'],
        message: `Agenda item ${index + 1} is missing a time`
      })
    }
    if (!activity) {
      fieldErrors.push({
        path: ['items', index, 'activity'],
        message: `Agenda item ${index + 1} is missing an activity`
      })
    }
    if (!additionalInfo) {
      fieldErrors.push({
        path: ['items', index, 'additionalInfo'],
        message: `Agenda item ${index + 1} is missing additional information`
      })
    }

    return { time, activity, additionalInfo }
  })

  if (fieldErrors.length > 0) throw new SerializerFieldError(fieldErrors)

  const heading = normalizeRichText(block.heading)
  const headingAttr = heading ? ` heading={${JSON.stringify(heading)}}` : ''
  const itemsAttr = ` items={${JSON.stringify(items)}}`

  return `<Agenda${headingAttr}${itemsAttr} />`
}
