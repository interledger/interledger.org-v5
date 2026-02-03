import fs from 'fs'
import path from 'node:path'

const articleTags = await fetchTags();

async function fetchTags () {
  const tagUrl = 'https://staging.interledger.org/jsonapi/taxonomy_term/tags'
  try {
    const response = await fetch(tagUrl)
    if (!response.ok) {
      throw new Error('Response status: ', response.status)
    }
    const result = await response.json()
    return result.data.map(tag => ({id: tag.id, name: tag.attributes.name}))

  } catch(err) {
    console.log('Error: ', err.message)
  }
}

function htmlToMarkdown(html) {
  if (!html) return ''

  return html
    .replace(/&nbsp;/gi, ' ')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([\s\S]*?)"[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function escapeQuotes(value) {
  return value.replace(/"/g, '\\"')
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toISOString().split('T')[0]
}

function generateFilename(post){
  const date = formatDate(post.attributes.created)
  const prefix = date ? `${date}-` : ''
  const alias = post?.attributes.path?.alias ?? ''
  const slug = alias
    .replace(/^\/news\//, '')
    .replace(/^\/+/, '')
    .toLowerCase()

  return `${prefix}${slug}.mdx`
}

function generateMDXContent(post) {
  const tagIds = post.relationships.field_tags.data.map( tag => tag.id)
  const tagNames = tagIds.map( id => articleTags.find(tag => tag.id == id)?.name)
  const frontmatterTags = `tags:\n${tagNames
  .map(a => `  - ${a}`)
  .join("\n")}`;
  
  const frontmatterLines = [
    `title: "${escapeQuotes(post.attributes.title)}"`,
    `description: "${escapeQuotes(post.attributes.body.summary)}"`,
    `date: ${formatDate(post.attributes.created)}`,
    `slug: ${post.attributes.path.alias.replace('/news/', '')}`,
    post.attributes.field_byline ? `authors:\n  - ${post.attributes.field_byline}` : undefined,
    tagNames ? frontmatterTags : undefined
  ].filter(Boolean)
  const frontmatter = frontmatterLines.join('\n')
  console.log('FRONTMATTER', frontmatter)
  const content = post.attributes.body.value ? htmlToMarkdown(post.attributes.body.value) : ''

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

async function writeMDXFile(post) {
  const projectRoot = process.cwd();
  const outputPath = '/src/content/blog'
  const blogDir = path.join(projectRoot, outputPath)
  if (!fs.existsSync(blogDir)) {
    fs.mkdirSync(blogDir, { recursive: true })
  }
  
  const filename = generateFilename(post)
  const filepath = path.join(blogDir, filename)
  const mdxContent = generateMDXContent(post)

  fs.writeFileSync(filepath, mdxContent, 'utf-8')
  console.log(`✅ Generated Blog Post MDX file: ${filepath}`)
}

async function importArticlesFromDrupal() {
  let articleUrl = "https://staging.interledger.org/jsonapi/node/article"; 

  const articles = []
  while (articleUrl) {
    try {
      const response = await fetch(articleUrl);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      const result = await response.json();
      articles.push(...result.data) 
      articleUrl = result.links?.next?.href ?? null
    } catch (error) {
      console.error(error.message);
    }
  }
  articles.forEach(async (article) => {
    await writeMDXFile(article);
  });
}

importArticlesFromDrupal();