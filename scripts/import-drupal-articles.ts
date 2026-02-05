import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const imgFilePath = '/public/img/foundation-blog'
const imgReferencePath = '/img/foundation-blog/'
const mdxFilePath = '/src/content/blog'
const drupalMediaUrl =
  'https://staging.interledger.org/sites/default/files/image-uploads/'

const articleTags = await fetchTags()

async function fetchTags() {
  const tagUrl = 'https://staging.interledger.org/jsonapi/taxonomy_term/tags'
  try {
    const response = await fetch(tagUrl)
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }
    const result = await response.json()
    return result.data.map((tag) => ({ id: tag.id, name: tag.attributes.name }))
  } catch (err) {
    console.error(`Error inside fetchTags: ${err.message}`)
    return []
  }
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

async function htmlToMarkdown(html: string) {
  if (!html) return ''

  // Replace drupal-media tags first (async)
  const mediaRegex =
    /<drupal-media[^>]*data-entity-uuid="([^"]*)"[^>]*>[\s\S]*?<\/drupal-media>/gi

  const matches = [...html.matchAll(mediaRegex)]
  const mediaUrlBase = `https://staging.interledger.org/jsonapi/media/image/`

  const replacements = await Promise.all(
    matches.map(async ([fullMatch, mediaId]) => {
      const mediaUrl = mediaUrlBase + mediaId
      // <drupal-media> only displays data-entity-type="media", I will assume they are images
      const media = await fetchMedia(mediaUrl, 'media--image')
      return {
        fullMatch,
        markdown: `![${media?.alt ?? ''}](${media?.url ?? ''})\n\n`
      }
    })
  )

  for (const r of replacements) {
    html = html.replaceAll(r.fullMatch, r.markdown)
  }

  return (
    html
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
      .replace(
        /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
        '```\n$1\n```'
      )
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<ul[^>]*>/gi, '\n')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '\n')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n')
      .replace(
        /<img[^>]*src="([^"]*)"[^>]*alt="([\s\S]*?)"[^>]*>/gi,
        '![$2]($1)'
      )
      .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
      // .replace(/<[^>]+>/g, '')
      .trim()
  )
}

async function saveImageToDisk(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`
    )
  }

  url = url.endsWith('/') ? url.slice(0, -1) : url
  const fileName = url.split('/').pop()
  const filePath = path.join(projectRoot, imgFilePath, fileName)
  const buffer = await response.arrayBuffer()

  await fs.promises.mkdir(path.join(projectRoot, imgFilePath), {
    recursive: true
  })

  await fs.promises.writeFile(filePath, Buffer.from(buffer))

  return imgReferencePath + fileName
}

async function fetchMedia(mediaAPILink, type) {
  try {
    const mediaResponse = await fetch(mediaAPILink)
    if (!mediaResponse.ok) {
      throw new Error(`Response status: ${response.status}`)
    }
    const mediaResult = await mediaResponse.json()
    const mediaName = mediaResult.data.attributes.name
    let mediaAlt; 
    
    switch (type) {
      case 'media--image': 
        mediaAlt = mediaResult.data.relationships.field_media_image.data.meta.alt ?? '';
        break; 
      case 'media--svg':
        mediaAlt = mediaResult.data.relationships.field_media_svg.data.meta.alt ?? '';
        break;
      default: 
        mediaAlt = undefined;
    }

    if (mediaName.includes(' ')) {
      console.error(`${mediaName} contains spaces!!! Please download manually`)
      return
    }

    const imageUrl = drupalMediaUrl + mediaName
    if (type === 'media--remote_video') {
      // don't save on disk, return embedded video link
      return {
        url: mediaResult.data.attributes.field_media_oembed_video,
        alt: undefined
      } 
    }
    return {
      url: await saveImageToDisk(imageUrl),
      alt: mediaAlt
    }
  } catch (err) {
    console.error(`Error in fetchMedia regarding image: ${mediaAPILink} ; ${err.message} `)
  }
}

async function getMediaInfo(media) {
  const { type, id } = media

  let mediaAPILink
  switch (type) {
    case 'media--image':
      mediaAPILink = `https://staging.interledger.org/jsonapi/media/image/${id}`
      break
    case 'media--svg':
      mediaAPILink = `https://staging.interledger.org/jsonapi/media/svg/${id}`
      break
    case 'media--remote_video':
      mediaAPILink = `https://staging.interledger.org/jsonapi/media/remote_video/${id}`
      break
    default:
      mediaAPILink = null
      console.log('Media is not of type image or svg!')
  }

  if (!mediaAPILink) return

  return await fetchMedia(mediaAPILink, type )
}

async function generateMDXContent(post) {
  const thumbnail = await getMediaInfo(
    post.relationships.field_article_thumbnail.data
  )
  const featureImage = await getMediaInfo(
    post.relationships.field_feature_image.data
  )

  const tagIds = post.relationships.field_tags.data.map((tag) => tag.id)
  const tagNames = tagIds.map(
    (id) => articleTags.find((tag) => tag.id === id)?.name
  )
  const frontmatterTags = `tags:\n${tagNames.map((a) => `  - ${a}`).join('\n')}`

  const frontmatterLines = [
    `title: "${escapeQuotes(post.attributes.title)}"`,
    `description: "${escapeQuotes(post.attributes.body?.summary ?? '')}"`,
    `date: ${formatDate(post.attributes.created)}`,
    `slug: ${post.attributes.path.alias.replace('/news/', '')}`,
    featureImage?.url ? `featureImage: "${featureImage.url}"` : undefined,
    `featureImageAlt: "${featureImage?.alt ?? undefined}"`,
    `pillar: "${post.attributes.field_pillar ?? ''}"`,
    thumbnail?.url ? `thumbnailImage: "${thumbnail.url}"` : undefined,
    `thumbnailAlt: "${thumbnail?.alt ?? undefined}"`,
    post.attributes.field_byline
      ? `authors:\n  - ${post.attributes.field_byline}`
      : undefined,
    tagNames ? frontmatterTags : undefined
  ].filter(Boolean)
  const frontmatter = frontmatterLines.join('\n')
  const content = post.attributes.body.value
    ? await htmlToMarkdown(post.attributes.body.value)
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
  // console.log(`✅ Generated Blog Post MDX file: ${filepath}`)
}

async function importArticlesFromDrupal() {
  let articleUrl = "https://staging.interledger.org/jsonapi/node/article";

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
      console.error(`Error in catch block inside importArticlesFromDrupal: ${error.message}`)
    }
  }
  await Promise.all(articles.map(writeMDXFile))
}

importArticlesFromDrupal()
