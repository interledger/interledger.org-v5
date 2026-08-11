import { describe, expect, it } from 'vitest'
import {
  findUnoptimizedImages,
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

  it('flags a degraded-marker image', () => {
    const html = `<img src="/uploads/img/original/new.png" alt="x" data-unoptimized-src="/uploads/img/original/new.png" />`
    expect(findUnoptimizedImages(html)).toEqual([
      { src: '/uploads/img/original/new.png', reason: 'degraded-marker' }
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
