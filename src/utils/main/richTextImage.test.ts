import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  setDeployedImageSourcesForTests,
  setImageCdnEnabledForTests,
  setOptimizedImageVariantCatalogForTests
} from './images'
import { parseMarkdown } from './mdx'
import { renderOptimizedImageHtml } from './richTextImage'

const UPLOAD = '/uploads/img/original/chart.png'

beforeEach(() => {
  setImageCdnEnabledForTests(false)
  setOptimizedImageVariantCatalogForTests([])
})

afterEach(() => {
  setOptimizedImageVariantCatalogForTests(null)
  setDeployedImageSourcesForTests(null)
  setImageCdnEnabledForTests(null)
})

describe('renderOptimizedImageHtml', () => {
  it('emits AVIF and WebP srcsets when variants exist', () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/uploads/chart-640.webp',
      '/img/optimized/uploads/chart-1280.webp',
      '/img/optimized/uploads/chart-640.avif'
    ])

    expect(renderOptimizedImageHtml({ src: UPLOAD, alt: 'Chart' })).toBe(
      '<picture>' +
        '<source type="image/avif" srcset="/img/optimized/uploads/chart-640.avif 640w" sizes="100vw">' +
        '<source type="image/webp" srcset="/img/optimized/uploads/chart-640.webp 640w, /img/optimized/uploads/chart-1280.webp 1280w" sizes="100vw">' +
        `<img src="${UPLOAD}" alt="Chart" loading="lazy" decoding="async">` +
        '</picture>'
    )
  })

  it('emits single-URL sources when only the full-size variant exists', () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/uploads/chart-full.webp'
    ])

    expect(renderOptimizedImageHtml({ src: UPLOAD, alt: 'Chart' })).toBe(
      '<picture>' +
        '<source type="image/webp" srcset="/img/optimized/uploads/chart-full.webp">' +
        `<img src="${UPLOAD}" alt="Chart" loading="lazy" decoding="async">` +
        '</picture>'
    )
  })

  it('routes through the image CDN when the source is deployed', () => {
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests([UPLOAD])

    const html = renderOptimizedImageHtml({ src: UPLOAD, alt: 'Chart' })

    expect(html).toContain('type="image/avif"')
    expect(html).toContain('/.netlify/images?')
    expect(html).not.toContain('data-unoptimized-src')
  })

  it('marks an eligible source that has nothing to serve as degraded', () => {
    expect(renderOptimizedImageHtml({ src: UPLOAD, alt: 'Chart' })).toBe(
      `<picture><img src="${UPLOAD}" alt="Chart" loading="lazy" decoding="async" data-unoptimized-src="${UPLOAD}"></picture>`
    )
  })

  it('leaves an ineligible source plain, with no degraded marker', () => {
    for (const src of ['/img/animation.gif', '/img/logo.svg']) {
      const html = renderOptimizedImageHtml({ src, alt: '' })
      expect(html).toBe(
        `<picture><img src="${src}" alt="" loading="lazy" decoding="async"></picture>`
      )
    }
  })

  it('escapes every attribute value', () => {
    const html = renderOptimizedImageHtml({
      src: '/img/a.gif?x="1"',
      alt: 'A <b> "quoted" alt',
      title: 'T & "t"'
    })

    expect(html).toContain('src="/img/a.gif?x=&quot;1&quot;"')
    expect(html).toContain('alt="A &lt;b&gt; &quot;quoted&quot; alt"')
    expect(html).toContain('title="T &amp; &quot;t&quot;"')
  })

  it('keeps existing character references instead of escaping them again', () => {
    const html = renderOptimizedImageHtml({
      src: '/img/a.gif',
      alt: 'A & B &amp; C&nbsp;D &#38; E',
      title: 'T &amp; t'
    })

    expect(html).toContain('alt="A &amp; B &amp; C&nbsp;D &#38; E"')
    expect(html).toContain('title="T &amp; t"')
  })

  it('renders only the alt text for an unsafe or empty source', () => {
    expect(
      renderOptimizedImageHtml({ src: 'javascript:alert(1)', alt: 'x <y>' })
    ).toBe('x &lt;y&gt;')
    expect(renderOptimizedImageHtml({ src: '', alt: 'Chart' })).toBe('Chart')
    expect(
      renderOptimizedImageHtml({ src: 'javascript:x', alt: 'a &amp; b' })
    ).toBe('a &amp; b')
  })
})

describe('parseMarkdown images', () => {
  it('routes a Markdown image through the optimizer', async () => {
    setOptimizedImageVariantCatalogForTests([
      '/img/optimized/uploads/chart-640.webp'
    ])

    const html = await parseMarkdown(`![A *bold* chart](${UPLOAD} "Q3")`)

    expect(html).toContain('<picture><source type="image/webp"')
    expect(html).toContain('alt="A bold chart"')
    expect(html).toContain('title="Q3"')
  })
})
