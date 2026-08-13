import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  auditImageOptimization,
  findUnoptimizedImages,
  isBlockingAuditReason,
  isOptimizableRasterPath
} from './audit-image-optimization'

describe('isOptimizableRasterPath', () => {
  it('accepts /img and /uploads rasters', () => {
    expect(isOptimizableRasterPath('/img/foundation-blog/hero.jpg')).toBe(true)
    expect(isOptimizableRasterPath('/uploads/img/original/x.png')).toBe(true)
    expect(isOptimizableRasterPath('/img/a.webp')).toBe(true)
  })

  it('rejects svgs, gifs, optimized output, and external paths', () => {
    expect(isOptimizableRasterPath('/img/logo.svg')).toBe(false)
    expect(isOptimizableRasterPath('/img/anim.gif')).toBe(false)
    expect(isOptimizableRasterPath('/img/optimized/hero-640.webp')).toBe(false)
    expect(isOptimizableRasterPath('/assets/hero.jpg')).toBe(false)
    expect(isOptimizableRasterPath('https://cdn.example.com/a.png')).toBe(false)
  })

  it('rejects extensions outside the encoder allowlist', () => {
    expect(isOptimizableRasterPath('/uploads/img/original/scan.tiff')).toBe(
      false
    )
  })

  it('ignores a query string when reading the extension', () => {
    expect(isOptimizableRasterPath('/img/hero.png?v=2')).toBe(true)
    expect(isOptimizableRasterPath('/img/logo.svg?v=2')).toBe(false)
  })
})

describe('isBlockingAuditReason', () => {
  it('blocks every reason that means a component bypassed the CDN', () => {
    expect(isBlockingAuditReason('standalone-raw')).toBe(true)
    expect(isBlockingAuditReason('picture-without-cdn')).toBe(true)
    expect(isBlockingAuditReason('raw-css-background')).toBe(true)
    expect(isBlockingAuditReason('raw-poster')).toBe(true)
  })

  it('does not block a degraded marker, which is the designed fallback', () => {
    expect(isBlockingAuditReason('degraded-marker')).toBe(false)
  })
})

describe('findUnoptimizedImages', () => {
  it('passes a CDN-backed <picture>', () => {
    const html = `
      <picture>
        <source type="image/avif" srcset="/.netlify/images?url=%2Fimg%2Fh.png&fm=avif&w=640 640w" />
        <source type="image/webp" srcset="/.netlify/images?url=%2Fimg%2Fh.png&fm=webp&w=640 640w" />
        <img src="/img/h.png" alt="ok" />
      </picture>`
    expect(findUnoptimizedImages(html)).toEqual([])
  })

  it('passes an <img> whose src is already a CDN URL', () => {
    const html = `<img src="/.netlify/images?url=%2Fimg%2Fh.png&fm=avif&w=1280" alt="ok" />`
    expect(findUnoptimizedImages(html)).toEqual([])
  })

  it('flags a standalone raw optimizable <img>', () => {
    const html = `<img src="/img/foundation-blog/ffi-banner.jpg" alt="hero" width="720" />`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/img/foundation-blog/ffi-banner.jpg', reason: 'standalone-raw' }
    ])
  })

  it('flags a raw upload image', () => {
    const html = `<img src="/uploads/img/original/erica.png" alt="x" />`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/uploads/img/original/erica.png', reason: 'standalone-raw' }
    ])
  })

  it('flags a <picture> that lacks a CDN <source>', () => {
    const html = `
      <picture>
        <source type="image/webp" srcset="/img/optimized/h-640.webp 640w" />
        <img src="/img/h.png" alt="x" />
      </picture>`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/img/h.png', reason: 'picture-without-cdn' }
    ])
  })

  it('ignores svgs and non-optimizable paths', () => {
    const html = `
      <img src="/img/logo.svg" alt="logo" />
      <img src="/assets/decor.png" alt="decor" />`
    expect(findUnoptimizedImages(html)).toEqual([])
  })

  it('honours the data-allow-unoptimized escape hatch', () => {
    const html = `<img src="/img/intentional.jpg" alt="x" data-allow-unoptimized />`
    expect(findUnoptimizedImages(html)).toEqual([])
  })

  it('reports a degraded-marker image as a non-blocking finding', () => {
    const html = `<img src="/uploads/img/original/new.png" alt="x" data-unoptimized-src="/uploads/img/original/new.png" />`
    const found = findUnoptimizedImages(html)
    expect(found).toEqual([
      { src: '/uploads/img/original/new.png', reason: 'degraded-marker' }
    ])
    expect(found.some((f) => isBlockingAuditReason(f.reason))).toBe(false)
  })

  it('keeps the degraded reason inside the source-less <picture> OptimizedImage emits', () => {
    // The real shape of the fallback branch: a <picture> wrapper with no
    // <source> at all, so `pictureClass` still applies. Classifying that as
    // picture-without-cdn would make every degrade a blocking finding.
    const html = `
      <picture class="w-full">
        <img src="/uploads/img/original/new.png" alt="x" data-unoptimized-src="/uploads/img/original/new.png" />
      </picture>`
    const found = findUnoptimizedImages(html)
    expect(found).toEqual([
      { src: '/uploads/img/original/new.png', reason: 'degraded-marker' }
    ])
    expect(found.some((f) => isBlockingAuditReason(f.reason))).toBe(false)
  })

  it('still flags a source-less <picture> whose <img> carries no marker', () => {
    const html = `<picture><img src="/img/h.png" alt="x" /></picture>`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/img/h.png', reason: 'picture-without-cdn' }
    ])
  })

  it('reports a degraded desktop source inside an otherwise CDN-backed <picture>', () => {
    // ImageBlock: mobile resolved, desktop degraded. Still non-blocking.
    const html = `
      <picture>
        <source media="(max-width: 809px)" srcset="/.netlify/images?url=%2Fuploads%2Fimg%2Foriginal%2Fm.png&w=640 640w" />
        <img src="/uploads/img/original/d.png" alt="x" data-unoptimized-src="/uploads/img/original/d.png" />
      </picture>`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/uploads/img/original/d.png', reason: 'degraded-marker' }
    ])
  })

  it('flags a raw raster in an inline background-image', () => {
    // The real shape: the YouTube facade renders its poster as a CSS
    // background, so the path never passes through an <img> at all.
    const html = `<div style="background-image: url('/img/home/poster.jpg')"></div>`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/img/home/poster.jpg', reason: 'raw-css-background' }
    ])
  })

  it('reads a url() past the inner quote of the style attribute', () => {
    // Regression: a naive ["'][^"']* attribute match stops at the inner quote
    // and silently sees no url() at all.
    const html = `<div class="x" style="color:red;background-image:url('/img/a.png');top:0"></div>`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/img/a.png', reason: 'raw-css-background' }
    ])
  })

  it('accepts every url() quoting style', () => {
    const html = `
      <div style="background-image:url(/img/bare.png)"></div>
      <div style='background-image:url("/img/double.png")'></div>
      <div style="background-image:url( '/img/spaced.png' )"></div>`
    expect(findUnoptimizedImages(html).map((f) => f.src)).toEqual([
      '/img/bare.png',
      '/img/double.png',
      '/img/spaced.png'
    ])
  })

  it('passes a CDN-backed background and a non-raster one', () => {
    // /img/bg-swirl.svg is on ~1300 pages; flagging SVGs would be all noise.
    const html = `
      <div style="background-image:url('/.netlify/images?url=%2Fimg%2Fa.png&w=1920')"></div>
      <div style="background-image:url(/img/bg-swirl.svg)"></div>
      <div style="background-image:url(https://cdn.example.com/a.png)"></div>`
    expect(findUnoptimizedImages(html)).toEqual([])
  })

  it('flags a raw poster attribute', () => {
    const html = `<video src="/v.mp4" poster="/img/home/poster.jpg"></video>`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/img/home/poster.jpg', reason: 'raw-poster' }
    ])
  })

  it('passes a CDN-backed poster', () => {
    const html = `<video src="/v.mp4" poster="/.netlify/images?url=%2Fimg%2Fp.jpg&fm=webp&w=1920"></video>`
    expect(findUnoptimizedImages(html)).toEqual([])
  })

  it('honours the escape hatch on a background and a poster', () => {
    const html = `
      <div style="background-image:url(/img/a.png)" data-allow-unoptimized></div>
      <video poster="/img/b.jpg" data-allow-unoptimized></video>`
    expect(findUnoptimizedImages(html)).toEqual([])
  })

  it('finds a background on a tag inside a <picture>', () => {
    // The <picture> pass consumes the block before the <img> sweep, so the
    // attribute sweep has to run against the original document.
    const html = `
      <picture style="background-image:url(/img/a.png)">
        <source srcset="/.netlify/images?url=%2Fimg%2Fb.png&w=640 640w" />
        <img src="/img/b.png" alt="x" />
      </picture>`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/img/a.png', reason: 'raw-css-background' }
    ])
  })

  it('reports each raw image once per occurrence', () => {
    const html = `
      <img src="/img/a.jpg" alt="a" />
      <picture>
        <source srcset="/.netlify/images?url=%2Fimg%2Fb.png&w=640 640w" />
        <img src="/img/b.png" alt="b" />
      </picture>
      <img src="/img/a.jpg" alt="a again" />`
    const found = findUnoptimizedImages(html)
    expect(found).toEqual([
      { src: '/img/a.jpg', reason: 'standalone-raw' },
      { src: '/img/a.jpg', reason: 'standalone-raw' }
    ])
  })
})

/**
 * Drives the real `astro:build:done` hook against a throwaway dist tree. The
 * pure helpers above classify a finding; only the hook decides whether a
 * classification stops the build, so the severity policy needs testing here.
 */
type BuildDoneHook = NonNullable<
  ReturnType<typeof auditImageOptimization>['hooks']['astro:build:done']
>

interface CapturedLogs {
  info: string[]
  warn: string[]
}

interface AuditRun {
  logs: CapturedLogs
  error: Error | null
}

async function runAudit(pages: Record<string, string>): Promise<AuditRun> {
  const distDir = await mkdtemp(path.join(tmpdir(), 'image-audit-'))
  try {
    for (const [name, html] of Object.entries(pages)) {
      const full = path.join(distDir, name)
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, html)
    }

    const logs: CapturedLogs = { info: [], warn: [] }
    const hook = auditImageOptimization().hooks[
      'astro:build:done'
    ] as BuildDoneHook

    let error: Error | null = null
    try {
      await hook({
        dir: pathToFileURL(`${distDir}/`),
        logger: {
          info: (message: string) => logs.info.push(message),
          warn: (message: string) => logs.warn.push(message)
        }
      } as unknown as Parameters<BuildDoneHook>[0])
    } catch (err) {
      error = err as Error
    }

    return { logs, error }
  } finally {
    await rm(distDir, { recursive: true, force: true })
  }
}

const CDN_PICTURE = `
  <picture>
    <source type="image/avif" srcset="/.netlify/images?url=%2Fimg%2Fh.png&fm=avif&w=640 640w" />
    <img src="/img/h.png" alt="ok" />
  </picture>`

// The shape OptimizedImage emits when the source is missing from the deploy:
// a <picture> wrapper with no <source> at all.
const DEGRADED = `
  <picture>
    <img src="/uploads/img/original/new.png" alt="x" data-unoptimized-src="/uploads/img/original/new.png" />
  </picture>`

const BYPASS = `<img src="/img/bypassed.jpg" alt="x" />`

describe('auditImageOptimization hook', () => {
  const originalImageCdn = process.env.IMAGE_CDN

  beforeEach(() => {
    process.env.IMAGE_CDN = 'on'
  })

  afterEach(() => {
    if (originalImageCdn === undefined) delete process.env.IMAGE_CDN
    else process.env.IMAGE_CDN = originalImageCdn
  })

  it('reports the scanned file count on a clean build', async () => {
    const { logs, error } = await runAudit({
      'index.html': CDN_PICTURE,
      'blog/index.html': CDN_PICTURE
    })

    expect(error).toBeNull()
    expect(logs.warn).toEqual([])
    expect(logs.info[0]).toContain('2 HTML file(s) scanned')
  })

  it('fails when there is no HTML to scan', async () => {
    // Otherwise a build whose output layout moved would report a clean audit
    // for pages this never opened.
    const { error } = await runAudit({})

    expect(error?.message).toContain('no HTML to scan')
  })

  it('warns but does not fail on a degraded image', async () => {
    const { logs, error } = await runAudit({ 'index.html': DEGRADED })

    expect(error).toBeNull()
    expect(logs.warn).toHaveLength(1)
    expect(logs.warn[0]).toContain('/uploads/img/original/new.png')
    expect(logs.warn[0]).toContain('degraded')
  })

  it('fails when a component bypassed the CDN', async () => {
    const { error } = await runAudit({ 'index.html': BYPASS })

    expect(error?.message).toContain('1 image(s) bypass')
    expect(error?.message).toContain('/img/bypassed.jpg')
  })

  it('fails on the bypass while still warning about a co-occurring degrade', async () => {
    const { logs, error } = await runAudit({
      'index.html': DEGRADED,
      'about/index.html': BYPASS
    })

    expect(error?.message).toContain('1 image(s) bypass')
    expect(error?.message).not.toContain('/uploads/img/original/new.png')
    expect(logs.warn[0]).toContain('/uploads/img/original/new.png')
  })

  it('fails on an inline background that bypassed the CDN', async () => {
    const { error } = await runAudit({
      'index.html': `<div style="background-image: url('/img/home/poster.jpg')"></div>`
    })

    expect(error?.message).toContain('/img/home/poster.jpg')
    expect(error?.message).toContain('inline style')
  })

  it('names the carriers it checked, so a clean run is not read as a guarantee', async () => {
    const { logs } = await runAudit({ 'index.html': CDN_PICTURE })

    expect(logs.info[0]).toContain('inline background')
    expect(logs.info[0]).toContain('poster')
  })

  it('skips entirely when the CDN is off', async () => {
    process.env.IMAGE_CDN = 'off'

    const { logs, error } = await runAudit({ 'index.html': BYPASS })

    expect(error).toBeNull()
    expect(logs.info[0]).toContain('CDN off')
  })
})
