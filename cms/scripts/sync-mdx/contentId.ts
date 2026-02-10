import fs from 'fs'
import matter from 'gray-matter'

/**
 * Update or add a frontmatter field in an MDX file.
 */
export function updateMdxFrontmatter(
  filepath: string,
  key: string,
  value: string
): boolean {
  try {
    const fileContent = fs.readFileSync(filepath, 'utf-8')
    const { data, content } = matter(fileContent)

    data[key] = value

    const newContent = matter.stringify(content, data)
    fs.writeFileSync(filepath, newContent, 'utf-8')
    return true
  } catch (error) {
    console.warn(`   ⚠️  Could not update frontmatter in: ${filepath}`)
    return false
  }
}

