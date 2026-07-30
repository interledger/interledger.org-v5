import { describe, expect, it } from 'vitest'
import { createMarked } from './mdx'

describe('createMarked', () => {
  it('injects the new attribute set on inline links', () => {
    const html = createMarked({
      pathname: '/resources',
      lang: 'en'
    }).parseInline(
      'See [Open Payments Docs](https://docs.interledger.org/) for more.'
    ) as string
    expect(html).toContain('data-umami-event="resources:link:docs_interledger"')
    expect(html).toContain('data-umami-event-link-text="Open Payments Docs"')
    expect(html).toContain('data-umami-event-lang="en"')
  })

  it('honours a label directive in the link title', () => {
    const html = createMarked({
      pathname: '/get-involved',
      lang: 'en'
    }).parseInline(
      '[Community Forum](https://forum.interledger.org/ "label:community")'
    ) as string
    expect(html).toContain('data-umami-event="get_involved:link"')
    expect(html).toContain('data-umami-event-label="community"')
    expect(html).not.toContain('title="label:community"')
  })

  it('preserves a non-directive title', async () => {
    const html = await createMarked({ pathname: '/' }).parse(
      '[hi](https://example.com "real title")'
    )
    expect(html).toContain('title="real title"')
    expect(html).toContain('data-umami-event="foundation_home:link:example"')
  })

  it('handles inline markdown inside link text', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      'Try [**bold** link](https://example.com)'
    ) as string
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('data-umami-event="foundation_home:link:example"')
    expect(html).toContain('data-umami-event-link-text="bold link"')
  })

  it('derives page from pathname when rendering markdown links', async () => {
    const html = await createMarked({ pathname: '/ambassadors' }).parse(
      '[Site](https://example.com)'
    )
    expect(html).toContain('data-umami-event="ambassadors:link:example"')
    expect(html).toContain('data-umami-event-link-text="Site"')
  })

  it('defaults to foundation_home when pathname is omitted', async () => {
    const html = (await createMarked({}).parse(
      '[docs](https://example.com/docs)'
    )) as string
    expect(html).toContain('data-umami-event="foundation_home:link:example"')
    expect(html).toContain('data-umami-event-link-text="docs"')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('data-umami-event=""')
    expect(html.match(/data-umami-event="/g)).toHaveLength(1)
  })

  it('does not use a junk segment when page is explicitly undefined (optional umamiContext)', async () => {
    const html = await createMarked({
      page: undefined,
      pathname: '/education',
      lang: 'en'
    }).parse('[Overview](/policy-and-advocacy)')
    expect(html).toContain(
      'data-umami-event="education:link:policy_and_advocacy"'
    )
    expect(html).not.toMatch(/:undefined|undefined:/)
  })

  it('escapes title attribute values and keeps umami attributes valid', async () => {
    const html = await createMarked({ pathname: '/' }).parse(
      '[hi](https://example.com "a title with \\"quotes\\"")'
    )
    expect(html).toContain('title="a title with &quot;quotes&quot;"')
    expect(html).toContain('data-umami-event="foundation_home:link:example"')
    expect(html).toContain('data-umami-event-link-text="hi"')
    expect(html).not.toContain('data-umami-event=""')
  })

  it('preserves multiple links on the same line', async () => {
    const html = await createMarked({ pathname: '/about-us' }).parse(
      '[one](https://a.com) and [two](https://b.com)'
    )
    expect(html.match(/data-umami-event="/g)).toHaveLength(2)
    expect(html).toContain('data-umami-event-link-text="one"')
    expect(html).toContain('data-umami-event-link-text="two"')
  })

  it('drops a javascript: link, keeping only its text', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      '[click me](javascript:alert(1))'
    ) as string
    expect(html).not.toContain('<a')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('click me')
  })

  it('drops a data: link, keeping only its text', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      '[click me](data:text/html,<script>alert(1)</script>)'
    ) as string
    expect(html).not.toContain('<a')
    expect(html).not.toContain('data:')
    expect(html).toContain('click me')
  })

  it('still renders a relative internal link', async () => {
    const html = await createMarked({ pathname: '/education' }).parse(
      '[Overview](/policy-and-advocacy)'
    )
    expect(html).toContain('<a href="/policy-and-advocacy"')
  })

  it('escapes a raw <script> tag in the markdown source', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      'Hello <script>alert(1)</script> world'
    ) as string
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes a raw HTML tag with an inline event handler', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      '<img src=x onerror=alert(1)>'
    ) as string
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('escapes a raw <a> tag with a javascript: href, bypassing the link renderer', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      '<a href="javascript:alert(1)">click</a>'
    ) as string
    expect(html).not.toContain('<a href')
    expect(html).toContain('&lt;a href')
  })
})
