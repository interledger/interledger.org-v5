import fs from 'fs'
import { NUMERIC_FIELDS } from './config'

export interface ParsedMDX {
  frontmatter: Record<string, string | number>
  content: string
}

export function parseMDX(
  filepath: string,
  numericFields: string[] = NUMERIC_FIELDS
): ParsedMDX {
  const content = fs.readFileSync(filepath, 'utf-8')
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/)

  if (!match) return { frontmatter: {}, content: '' }

  const frontmatter: Record<string, string | number> = {}
  const lines = match[1].split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim()
      let value: string | number = line.substring(colonIndex + 1).trim()

      value = value.replace(/^["']|["']$/g, '')

      if (numericFields.includes(key) && /^\d+$/.test(value)) {
        value = parseInt(value, 10)
      }

      frontmatter[key] = value
    }
  }

  return { frontmatter, content: (match[2] || '').trim() }
}
