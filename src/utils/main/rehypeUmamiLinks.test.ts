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
  it('emits the flat link label with inline_link, plus current/destination path properties', async () => {
    const out = await run(
      '<p>Visit <a href="/policy-and-advocacy">advocate</a> today.</p>'
    )
    expect(out).toContain('data-umami-event="link"')
    expect(out).toContain('data-umami-event-base-component="inline_link"')
    expect(out).toContain('data-umami-event-link-text="advocate"')
    expect(out).toContain('data-umami-event-lang="en"')
    expect(out).toContain('data-umami-event-current-path="about_us"')
    expect(out).toContain('data-umami-event-current-section="foundation"')
    expect(out).toContain(
      'data-umami-event-destination-path="policy_and_advocacy"'
    )
    expect(out).toContain('data-umami-event-destination-section="foundation"')
    expect(out).toContain('href="/policy-and-advocacy"')
  })

  it('derives lang from a locale-prefixed slug', async () => {
    const out = await run(
      '<p><a href="/grant/fellowship">ambassador</a></p>',
      '/repo/src/content/foundation-pages/es/about-us.mdx'
    )
    expect(out).toContain('data-umami-event-lang="es"')
    expect(out).toContain('data-umami-event-current-path="about_us"')
    expect(out).toContain('data-umami-event-destination-path="grant"')
  })

  it('honours frontmatter umamiContext as the current_path override, never the section', async () => {
    const out = await run(
      '<a href="/x">See docs</a>',
      '/repo/src/content/foundation-pages/about-us.mdx',
      { umamiContext: 'custom_page' }
    )
    expect(out).toContain('data-umami-event-current-path="custom_page"')
    expect(out).toContain('data-umami-event-current-section="foundation"')
  })

  it('extracts a label directive from the title as a base_component override, and drops the title attr', async () => {
    const out = await run(
      '<a href="https://forum.interledger.org/" title="label:community">Community Forum</a>',
      '/repo/src/content/foundation-pages/get-involved.mdx'
    )
    expect(out).toContain('data-umami-event="link"')
    expect(out).toContain('data-umami-event-base-component="community"')
    expect(out).toContain('data-umami-event-link-text="Community Forum"')
    expect(out).not.toContain('title="label:community"')
  })

  it('preserves a non-directive title', async () => {
    const out = await run(
      '<a href="/x" title="real title">link</a>',
      '/repo/src/content/foundation-pages/about-us.mdx'
    )
    expect(out).toContain('title="real title"')
    expect(out).toContain('data-umami-event-base-component="inline_link"')
  })

  it('classifies internal and external destinations independently, with no malformed attributes', async () => {
    const out = await run(
      '<p><a href="/policy">advocate</a> and <a href="https://example.org/">external</a></p>',
      '/repo/src/content/foundation-pages/about-us.mdx',
      {}
    )
    expect(out).toContain('data-umami-event-destination-path="policy"')
    expect(out).toContain('data-umami-event-destination-section="foundation"')
    expect(out).toContain('data-umami-event-destination-path="other_external"')
    expect(out).toContain('data-umami-event-destination-section="external"')
    expect(out).not.toContain('undefined')
    expect(out).not.toContain('data-umami-event=""')
    expect(out.match(/data-umami-event="link"/g)).toHaveLength(2)
  })

  it('leaves existing data-umami-event attributes untouched', async () => {
    const out = await run(
      '<a href="/x" data-umami-event="Existing event">kept</a>'
    )
    expect(out).toContain('data-umami-event="Existing event"')
    expect(out).not.toContain('data-umami-event-base-component')
  })

  it('skips Starlight docs content', async () => {
    const out = await run(
      '<a href="/developers/get-started">Get started</a>',
      '/repo/src/content/docs/developers/overview.mdx'
    )
    expect(out).not.toContain('data-umami-event')
  })

  it('flattens nested inline markup inside <a>', async () => {
    const out = await run('<p><a href="/x"><strong>bold</strong> link</a></p>')
    expect(out).toContain('data-umami-event-link-text="bold link"')
  })

  describe('new-tab links', () => {
    it('opens an external link in a new tab with an sr-only hint', async () => {
      const out = await run('<a href="https://rafiki.dev/">Rafiki</a>')
      expect(out).toContain('target="_blank"')
      expect(out).toContain('rel="noopener noreferrer"')
      expect(out).toContain(
        'Rafiki<span class="sr-only"> (opens in a new tab)</span></a>'
      )
    })

    it('keeps the hint out of the umami link text', async () => {
      const out = await run('<a href="https://rafiki.dev/">Rafiki</a>')
      expect(out).toContain('data-umami-event-link-text="Rafiki"')
    })

    it('localizes the hint from the content path', async () => {
      const out = await run(
        '<a href="https://rafiki.dev/">Rafiki</a>',
        '/repo/src/content/foundation-pages/es/about-us.mdx'
      )
      expect(out).toContain('(se abre en una pestaña nueva)')
    })

    it.each([
      '/about-us',
      'https://www.interledger.org/about-us',
      '#faq',
      'mailto:info@interledger.org'
    ])('keeps %s in the same tab', async (href) => {
      const out = await run(`<a href="${href}">link</a>`)
      expect(out).not.toContain('target=')
      expect(out).not.toContain('sr-only')
    })

    it('keeps a target the author already set', async () => {
      const out = await run(
        '<a href="https://rafiki.dev/" target="_self">Rafiki</a>'
      )
      expect(out).toContain('target="_self"')
      expect(out).not.toContain('noopener')
      expect(out).not.toContain('sr-only')
    })

    it('still adds new-tab attributes when umami attributes already exist', async () => {
      const out = await run(
        '<a href="https://rafiki.dev/" data-umami-event="Existing">Rafiki</a>'
      )
      expect(out).toContain('data-umami-event="Existing"')
      expect(out).toContain('target="_blank"')
    })

    it('skips Starlight docs content', async () => {
      const out = await run(
        '<a href="https://rafiki.dev/">Rafiki</a>',
        '/repo/src/content/docs/developers/overview.mdx'
      )
      expect(out).not.toContain('target=')
    })

    it('omits the hint inside a heading so the slugged id stays stable', async () => {
      const out = await run(
        '<h3>News - <a href="https://forbes.com/x">Forbes</a></h3>'
      )
      expect(out).toContain('target="_blank"')
      expect(out).not.toContain('sr-only')
    })
  })
})
