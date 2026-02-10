import fs from 'fs'

/**
 * Update or add a frontmatter field in an MDX file.
 */
export function updateMdxFrontmatter(
  filepath: string,
  key: string,
  value: string
): boolean {
  const content = fs.readFileSync(filepath, 'utf-8')
  const match = content.match(/^(---\n)([\s\S]*?)(\n---)([\s\S]*)$/)

  if (!match) {
    console.warn(`   ⚠️  Could not parse frontmatter in: ${filepath}`)
    return false
  }

  const [, openDelim, frontmatterBody, closeDelim, rest] = match
  const lines = frontmatterBody.split('\n')

  // Check if key already exists
  let keyExists = false
  let keyIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const colonIndex = lines[i].indexOf(':')
    if (colonIndex > 0) {
      const existingKey = lines[i].substring(0, colonIndex).trim()
      if (existingKey === key) {
        keyExists = true
        keyIndex = i
        break
      }
    }
  }

  const quotedValue = `"${value}"`

  if (keyExists) {
    lines[keyIndex] = `${key}: ${quotedValue}`
  } else {
    lines.push(`${key}: ${quotedValue}`)
  }

  const newContent = openDelim + lines.join('\n') + closeDelim + rest
  fs.writeFileSync(filepath, newContent, 'utf-8')
  return true
}

/**
 * Read a specific frontmatter field from an MDX file.
 */
export function readMdxFrontmatterField(
  filepath: string,
  key: string
): string | null {
  const content = fs.readFileSync(filepath, 'utf-8')
  const match = content.match(/^---\n([\s\S]*?)\n---/)

  if (!match) return null

  const lines = match[1].split('\n')
  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const existingKey = line.substring(0, colonIndex).trim()
      if (existingKey === key) {
        let value = line.substring(colonIndex + 1).trim()
        value = value.replace(/^["']|["']$/g, '')
        return value
      }
    }
  }

  return null
}
