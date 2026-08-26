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
    expect(html).toContain('data-umami-event="link"')
    expect(html).toContain('data-umami-event-base-component="inline_link"')
    expect(html).toContain('data-umami-event-link-text="Open Payments Docs"')
    expect(html).toContain('data-umami-event-lang="en"')
    expect(html).toContain('data-umami-event-current-path="resources"')
    expect(html).toContain('data-umami-event-current-section="foundation"')
    expect(html).toContain('data-umami-event-destination-path="other_external"')
    expect(html).toContain('data-umami-event-destination-section="external"')
  })

  it('honours a label directive in the link title as a base_component override', () => {
    const html = createMarked({
      pathname: '/get-involved',
      lang: 'en'
    }).parseInline(
      '[Community Forum](https://forum.interledger.org/ "label:community")'
    ) as string
    expect(html).toContain('data-umami-event="link"')
    expect(html).toContain('data-umami-event-base-component="community"')
    expect(html).toContain('data-umami-event-current-path="get_involved"')
    expect(html).not.toContain('title="label:community"')
  })

  it('preserves a non-directive title', async () => {
    const html = await createMarked({ pathname: '/' }).parse(
      '[hi](https://example.com "real title")'
    )
    expect(html).toContain('title="real title"')
    expect(html).toContain('data-umami-event-base-component="inline_link"')
    expect(html).toContain('data-umami-event-current-path="foundation_home"')
    expect(html).toContain('data-umami-event-destination-path="other_external"')
  })

  it('handles inline markdown inside link text', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      'Try [**bold** link](https://example.com)'
    ) as string
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('data-umami-event="link"')
    expect(html).toContain('data-umami-event-link-text="bold link"')
  })

  it('derives current_path from pathname when rendering markdown links', async () => {
    const html = await createMarked({ pathname: '/ambassadors' }).parse(
      '[Site](https://example.com)'
    )
    expect(html).toContain('data-umami-event-current-path="ambassadors"')
    expect(html).toContain('data-umami-event-link-text="Site"')
  })

  it('defaults to foundation_home when pathname is omitted', async () => {
    const html = (await createMarked({}).parse(
      '[docs](https://example.com/docs)'
    )) as string
    expect(html).toContain('data-umami-event-current-path="foundation_home"')
    expect(html).toContain('data-umami-event-link-text="docs"')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('data-umami-event=""')
    expect(html.match(/data-umami-event="link"/g)).toHaveLength(1)
  })

  it('does not use a junk segment when page is explicitly undefined (optional umamiContext)', async () => {
    const html = await createMarked({
      page: undefined,
      pathname: '/education',
      lang: 'en'
    }).parse('[Overview](/policy-and-advocacy)')
    expect(html).toContain('data-umami-event-current-path="education"')
    expect(html).toContain(
      'data-umami-event-destination-path="policy_and_advocacy"'
    )
    expect(html).not.toMatch(/:undefined|undefined:/)
  })

  it('escapes title attribute values and keeps umami attributes valid', async () => {
    const html = await createMarked({ pathname: '/' }).parse(
      '[hi](https://example.com "a title with \\"quotes\\"")'
    )
    expect(html).toContain('title="a title with &quot;quotes&quot;"')
    expect(html).toContain('data-umami-event-current-path="foundation_home"')
    expect(html).toContain('data-umami-event-link-text="hi"')
    expect(html).not.toContain('data-umami-event=""')
  })

  it('preserves multiple links on the same line', async () => {
    const html = await createMarked({ pathname: '/about-us' }).parse(
      '[one](https://a.com) and [two](https://b.com)'
    )
    expect(html.match(/data-umami-event="link"/g)).toHaveLength(2)
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

  it('renders a single \\n within a paragraph as a real line break (breaks: true)', async () => {
    const html = await createMarked({ pathname: '/' }).parse(
      'line one\nline two'
    )
    expect(html).toContain('<br>')
    expect(html).toContain('<p>line one<br>line two</p>')
  })

  it('still splits a double \\n\\n into separate paragraphs', async () => {
    const html = await createMarked({ pathname: '/' }).parse(
      'para one\n\npara two'
    )
    expect(html).toContain('<p>para one</p>')
    expect(html).toContain('<p>para two</p>')
  })

  it('breaks: true does not affect raw HTML tag escaping', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      'Hello <script>alert(1)</script> world'
    ) as string
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
