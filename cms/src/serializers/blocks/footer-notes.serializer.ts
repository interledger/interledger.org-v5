export function serialize(block: {
  notes?: {
    text?: string
    linkText?: string
    linkUrl?: string
  }[]
}): string {
  // Strapi's `required: true` on `notes`/`text` isn't enforced at save time
  if (!block.notes || block.notes.length < 1) {
    throw new Error('Footer Notes block requires at least 1 note')
  }

  const noteItems = block.notes.map((note, i) => {
    const text = note.text?.trim()
    if (!text) {
      throw new Error(`Footer Notes block: note ${i + 1} is missing text`)
    }

    // Link is all-or-nothing: only emit it when both linkText and linkUrl
    // are present, so a half-filled pair in Strapi is dropped on export
    // (matching the import handler and how FooterNotes.astro renders it).
    const linkText = note.linkText?.trim()
    const linkUrl = note.linkUrl?.trim()
    const hasLink = Boolean(linkText && linkUrl)

    return {
      text,
      ...(hasLink ? { linkText, linkUrl } : {})
    }
  })

  const notesAttr = ` notes={${JSON.stringify(noteItems)}}`

  return `<FooterNotes${notesAttr} />`
}
