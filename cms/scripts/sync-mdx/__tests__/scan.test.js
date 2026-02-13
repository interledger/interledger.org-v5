const { describe, it, expect, afterEach } = require('bun:test')
const path = require('path')
const matter = require('gray-matter')

const { scanMDXFiles } = require('../scan')
const { makeTmpDir, writeFile, registerCleanup } = require('./helpers')

registerCleanup(afterEach)

describe('gray-matter parsing', () => {
  it('parses frontmatter and content', () => {
    const tmpDir = makeTmpDir()
    const filePath = path.join(tmpDir, 'sample.mdx')
    const fileContent = [
      '---',
      'title: "Hello"',
      'slug: "hello"',
      'order: 2',
      '---',
      '',
      'Body content'
    ].join('\n')
    writeFile(filePath, fileContent)

    const { data: frontmatter, content } = matter(fileContent)
    expect(frontmatter.title).toBe('Hello')
    expect(frontmatter.slug).toBe('hello')
    expect(frontmatter.order).toBe(2)
    expect(content.trim()).toBe('Body content')
  })
})

describe('scanMDXFiles', () => {
  it('scans base and locale directories', () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const blogDir = path.join(contentRoot, 'blog')
    const esBlogDir = path.join(contentRoot, 'es', 'blog')

    writeFile(
      path.join(blogDir, '2026-01-01-hello.mdx'),
      ['---', 'title: "Hello"', '---', '', 'Hi'].join('\n')
    )

    writeFile(
      path.join(esBlogDir, '2026-01-01-hola.mdx'),
      ['---', 'title: "Hola"', 'locale: "es"', 'localizes: "hello"', '---'].join('\n')
    )

    const contentTypes = {
      blog: { dir: blogDir }
    }

    const results = scanMDXFiles('blog', contentTypes)
    expect(results.length).toBe(2)

    const english = results.find((item) => item.locale === 'en')
    const spanish = results.find((item) => item.locale === 'es')

    expect(english.slug).toBe('hello')
    expect(english.isLocalization).toBe(false)
    expect(spanish.slug).toBe('hola')
    expect(spanish.isLocalization).toBe(true)
    expect(spanish.localizes).toBe('hello')
  })

  it('derives slug from filename and respects frontmatter slug and locale', () => {
    const tmpDir = makeTmpDir()
    const contentRoot = path.join(tmpDir, 'src', 'content')
    const blogDir = path.join(contentRoot, 'blog')
    const frBlogDir = path.join(contentRoot, 'fr', 'blog')

    writeFile(
      path.join(blogDir, '2026-02-02-hello-world.mdx'),
      ['---', 'title: "Hello"', '---', '', 'Hi'].join('\n')
    )

    writeFile(
      path.join(blogDir, 'custom.mdx'),
      ['---', 'title: "Custom"', 'slug: "custom-slug"', '---'].join('\n')
    )

    writeFile(
      path.join(frBlogDir, 'bonjour.mdx'),
      ['---', 'title: "Bonjour"', 'locale: "fr-CA"', '---'].join('\n')
    )

    writeFile(path.join(blogDir, 'ignore.txt'), 'skip')

    const contentTypes = {
      blog: { dir: blogDir }
    }

    const results = scanMDXFiles('blog', contentTypes)
    expect(results.length).toBe(3)

    const dated = results.find((item) => item.slug === 'hello-world')
    const custom = results.find((item) => item.slug === 'custom-slug')
    const french = results.find((item) => item.locale === 'fr-CA')

    expect(dated).toBeTruthy()
    expect(custom).toBeTruthy()
    expect(french.isLocalization).toBe(true)
  })
})
