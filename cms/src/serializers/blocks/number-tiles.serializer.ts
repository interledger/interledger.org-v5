export function serialize(block: {
  tiles?: {
    number?: string
    superscript?: string
    description?: string
  }[]
}): string {
  // Strapi's `required: true` on `tiles`/`number`/`description` isn't enforced at save time
  if (!block.tiles || block.tiles.length < 2) {
    throw new Error('Number Tiles block requires at least 2 tiles')
  }

  const tileItems = block.tiles.map((tile, i) => {
    if (!tile.number) {
      throw new Error(`Number Tiles block: tile ${i + 1} is missing a number`)
    }
    if (!tile.description) {
      throw new Error(
        `Number Tiles block: tile ${i + 1} is missing a description`
      )
    }
    return {
      number: tile.number,
      ...(tile.superscript ? { superscript: tile.superscript } : {}),
      description: tile.description
    }
  })

  const tilesAttr = ` tiles={${JSON.stringify(tileItems)}}`

  return `<NumberTiles${tilesAttr} />`
}
