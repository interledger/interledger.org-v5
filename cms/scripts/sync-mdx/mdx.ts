import fs from 'fs'
import matter from 'gray-matter'

export interface ParsedMDX {
  frontmatter: Record<string, unknown>
  content: string
}

export function parseMDX(filepath: string): ParsedMDX {
  const fileContent = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(fileContent)

  return {
    frontmatter: data,
    content: content.trim()
  }
}
