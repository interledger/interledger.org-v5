export function serialize(block: {
  title?: string
  tiles?: {
    number?: string
    prefix?: string
    suffix?: string
    description?: string
  }[]
}): string {
  // Strapi's `required: true` on `tiles`/`number`/`description` isn't enforced at save time
  if (!block.tiles || block.tiles.length < 2) {
    throw new Error('Number Tiles block requires at least 2 tiles')
  }

  const tileItems = block.tiles.map((tile, i) => {
    const number = tile.number?.trim()
    if (!number) {
      throw new Error(`Number Tiles block: tile ${i + 1} is missing a number`)
    }
    const description = tile.description?.trim()
    if (!description) {
      throw new Error(
        `Number Tiles block: tile ${i + 1} is missing a description`
      )
    }
    const prefix = tile.prefix?.trim()
    const suffix = tile.suffix?.trim()
    return {
      number,
      ...(prefix ? { prefix } : {}),
      ...(suffix ? { suffix } : {}),
      description
    }
  })

  const title = block.title?.trim()
  const titleAttr = title ? ` title=${JSON.stringify(title)}` : ''
  const tilesAttr = ` tiles={${JSON.stringify(tileItems)}}`

  return `<NumberTiles${titleAttr}${tilesAttr} />`
}
