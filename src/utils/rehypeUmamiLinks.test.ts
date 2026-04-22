import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { VFile } from 'vfile'
import { describe, expect, it } from 'vitest'
import rehypeUmamiLinks from './rehypeUmamiLinks'

const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeUmamiLinks)
  .use(rehypeStringify)

async function run(
  html: string,
  path = '/repo/src/content/foundation-pages/about-us.mdx',
  frontmatter: Record<string, unknown> = {}
): Promise<string> {
  const file = new VFile({ path, value: html })
  file.data = { astro: { frontmatter } }
  return String(await processor.process(file))
}

describe('rehypeUmamiLinks', () => {
  it('adds data-umami-event to anchors in foundation-pages mdx', async () => {
    const out = await run(
      '<p>Visit <a href="/policy-and-advocacy">advocate</a> today.</p>'
    )
    expect(out).toContain('data-umami-event="About Us page link - advocate"')
    expect(out).toContain('href="/policy-and-advocacy"')
  })

  it('derives page label from a locale-prefixed path', async () => {
    const out = await run(
      '<p><a href="/grant/fellowship">ambassador</a></p>',
      '/repo/src/content/foundation-pages/es/about-us.mdx'
    )
    expect(out).toContain('data-umami-event="About Us page link - ambassador"')
  })

  it('honours frontmatter umamiContext when provided', async () => {
    const out = await run(
      '<a href="/x">See docs</a>',
      '/repo/src/content/foundation-pages/about-us.mdx',
      { umamiContext: 'Custom Label page' }
    )
    expect(out).toContain(
      'data-umami-event="Custom Label page link - See docs"'
    )
  })

  it('leaves existing data-umami-event attributes untouched', async () => {
    const out = await run(
      '<a href="/x" data-umami-event="Existing event">kept</a>'
    )
    expect(out).toContain('data-umami-event="Existing event"')
    expect(out).not.toContain('About Us page link')
  })

  it('skips Starlight docs content', async () => {
    const out = await run(
      '<a href="/developers/get-started">Get started</a>',
      '/repo/src/content/docs/developers/overview.mdx'
    )
    expect(out).not.toContain('data-umami-event')
  })

  it('falls back to href-derived label for empty anchors', async () => {
    const out = await run('<a href="https://example.com/docs/"></a>')
    expect(out).toContain(
      'data-umami-event="About Us page link - example.com/docs"'
    )
  })

  it('flattens nested inline markup inside <a>', async () => {
    const out = await run('<p><a href="/x"><strong>bold</strong> link</a></p>')
    expect(out).toContain('data-umami-event="About Us page link - bold link"')
  })
})
