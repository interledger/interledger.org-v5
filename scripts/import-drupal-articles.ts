import fs from 'fs'
import path from 'node:path'

const projectRoot = process.cwd()
const imgFilePath = '/public/img/foundation-blog'
const mdxFilePath = '/src/content/blog'
const articleTags = await fetchTags()

async function saveImageToDisk(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`
    )
  }

  const fileName = url.split('/').pop()
  const filePath = path.join(projectRoot, imgFilePath, fileName)
  console.log('FILEPATH for image: ', filePath)
  const buffer = await response.arrayBuffer()

  await fs.promises.writeFile(filePath, Buffer.from(buffer))
  return filePath
}

async function fetchTags() {
  const tagUrl = 'https://staging.interledger.org/jsonapi/taxonomy_term/tags'
  try {
    const response = await fetch(tagUrl)
    if (!response.ok) {
      throw new Error('Response status: ', response.status)
    }
    const result = await response.json()
    return result.data.map((tag) => ({ id: tag.id, name: tag.attributes.name }))
  } catch (err) {
    console.error('Error: ', err.message)
  }
}

function htmlToMarkdown(html: string) {
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

function escapeQuotes(value: string) {
  return value.replace(/"/g, '\\"')
}

function formatDate(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toISOString().split('T')[0]
}

function generateFilename(post) {
  const date = formatDate(post.attributes.created)
  const prefix = date ? `${date}-` : ''
  const alias = post?.attributes.path?.alias ?? ''
  const slug = alias
    .replace(/^\/news\//, '')
    .replace(/^\/+/, '')
    .toLowerCase()

  return `${prefix}${slug}.mdx`
}

async function getImageInfo(media) {
  const { type, id } = media

  let imageAPILink
  switch (type) {
    case 'media--image':
      imageAPILink = `https://staging.interledger.org/jsonapi/media/image/${id}`
      break
    case 'media--svg':
      imageAPILink = `https://staging.interledger.org/jsonapi/media/svg/${id}`
      break
    default:
      imageAPILink = null
      console.log('Media is not of type image or svg!')
  }

  if (!imageAPILink) return

  try {
    const mediaResponse = await fetch(imageAPILink)
    if (!mediaResponse.ok) {
      throw new Error('Response status: ', mediaResponse.status)
    }
    const mediaResult = await mediaResponse.json()
    const imageName = mediaResult.data.attributes.name
    const imageAlt =
      mediaResult.data.relationships.field_media_image.data.meta.alt
    if (imageName.includes(' ')) {
      console.error(`${imageName} contains spaces!!!`)
      return
    } else {
      const imageUrl = `https://staging.interledger.org/sites/default/files/image-uploads/${imageName}`

      await saveImageToDisk(imageUrl)
      return {
        url: '/developers/img/foundation-blog/' + imageName,
        alt: imageAlt
      }
    }
  } catch (err) {
    console.error('Error: ', err.message)
  }
}

async function generateMDXContent(post) {
  const { url: thumbnailImageUrl, alt: thumbnailImageAlt } = await getImageInfo(
    post.relationships.field_article_thumbnail.data
  )
  const { url: featureImageUrl, alt: featureImageAlt } = await getImageInfo(
    post.relationships.field_feature_image.data
  )
  const tagIds = post.relationships.field_tags.data.map((tag) => tag.id)
  const tagNames = tagIds.map(
    (id) => articleTags.find((tag) => tag.id == id)?.name
  )
  const frontmatterTags = `tags:\n${tagNames.map((a) => `  - ${a}`).join('\n')}`

  const frontmatterLines = [
    `title: "${escapeQuotes(post.attributes.title)}"`,
    `description: "${escapeQuotes(post.attributes.body.summary)}"`,
    `date: ${formatDate(post.attributes.created)}`,
    `slug: ${post.attributes.path.alias.replace('/news/', '')}`,
    featureImageUrl ? `featureImage: "${featureImageUrl}"` : undefined,
    `featureImageAlt: "${featureImageAlt ?? ''}"`,
    thumbnailImageUrl ? `thumbnailImage: "${thumbnailImageUrl}"` : undefined,
    `thumbnailImageAlt: "${thumbnailImageAlt ?? ''}"`,
    post.attributes.field_byline
      ? `authors:\n  - ${post.attributes.field_byline}`
      : undefined,
    tagNames ? frontmatterTags : undefined
  ].filter(Boolean)
  const frontmatter = frontmatterLines.join('\n')
  // console.log('FRONTMATTER', frontmatter)
  const content = post.attributes.body.value
    ? htmlToMarkdown(post.attributes.body.value)
    : ''

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

async function writeMDXFile(post) {
  const blogDir = path.join(projectRoot, mdxFilePath)
  if (!fs.existsSync(blogDir)) {
    fs.mkdirSync(blogDir, { recursive: true })
  }

  const filename = generateFilename(post)
  const filepath = path.join(blogDir, filename)
  const mdxContent = await generateMDXContent(post)

  fs.writeFileSync(filepath, mdxContent, 'utf-8')
  console.log(`✅ Generated Blog Post MDX file: ${filepath}`)
}

async function importArticlesFromDrupal() {
  // all articles:
  // let articleUrl = "https://staging.interledger.org/jsonapi/node/article";
  // filtered article - with multiple tags:
  let articleUrl =
    'https://staging.interledger.org/jsonapi/node/article?filter[title]=2025%20Interledger%20Policy%20Activation%20Grantee:%20The%20Alliance%20of%20Digital%20Finance%20and%20Fintech%20Associations'
  const articles = []
  while (articleUrl) {
    try {
      const response = await fetch(articleUrl)
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`)
      }

      const result = await response.json()
      articles.push(...result.data)
      articleUrl = result.links?.next?.href ?? null
    } catch (error) {
      console.error(error.message)
    }
  }
  articles.forEach(async (article) => {
    await writeMDXFile(article)
  })
}

importArticlesFromDrupal()
