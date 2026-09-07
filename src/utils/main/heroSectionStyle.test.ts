import { afterEach, describe, expect, it } from 'vitest'
import {
  setDeployedImageSourcesForTests,
  setImageCdnEnabledForTests
} from './images'
import { getHeroSectionStyle } from './heroSectionStyle'

afterEach(() => {
  setDeployedImageSourcesForTests(null)
  setImageCdnEnabledForTests(null)
})

describe('getHeroSectionStyle', () => {
  it('keeps CDN URLs unchanged', () => {
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests(['/img/hero image.jpg'])

    expect(getHeroSectionStyle('/img/hero image.jpg')).toEqual({
      backgroundImage:
        "url('/.netlify/images?url=%2Fimg%2Fhero+image.jpg&fm=webp&w=1920&q=90')"
    })
  })

  it('degrades to the raw path when the source is missing from this deploy', () => {
    setImageCdnEnabledForTests(true)
    setDeployedImageSourcesForTests([])

    expect(getHeroSectionStyle('/img/hero image.jpg')).toEqual({
      backgroundImage: "url('/img/hero%20image.jpg')"
    })
  })

  it('still escapes a raw fallback path when no optimized URL exists', () => {
    setImageCdnEnabledForTests(false)

    expect(getHeroSectionStyle('/elsewhere/hero image.jpg')).toEqual({
      backgroundImage: "url('/elsewhere/hero%20image.jpg')"
    })
  })

  it('encodes per segment, not with encodeURI, so a comma in the filename cannot split the value', () => {
    setImageCdnEnabledForTests(false)

    expect(getHeroSectionStyle('/elsewhere/hero,photo.jpg')).toEqual({
      backgroundImage: "url('/elsewhere/hero%2Cphoto.jpg')"
    })
  })

  it('keeps an absolute fallback URL intact instead of mangling its scheme/host and query string', () => {
    setImageCdnEnabledForTests(false)

    expect(
      getHeroSectionStyle('https://cdn.example.com/uploads/hero.jpg?v=2')
    ).toEqual({
      backgroundImage: "url('https://cdn.example.com/uploads/hero.jpg?v=2')"
    })
  })

  it('layers a blur placeholder underneath the real image when provided', () => {
    setImageCdnEnabledForTests(false)

    expect(
      getHeroSectionStyle('/elsewhere/hero.jpg', 'data:image/webp;base64,AAA')
    ).toEqual({
      backgroundImage:
        "url('/elsewhere/hero.jpg'), url('data:image/webp;base64,AAA')"
    })
  })

  it('omits the second layer when no blur placeholder is given', () => {
    setImageCdnEnabledForTests(false)

    expect(getHeroSectionStyle('/elsewhere/hero.jpg')).toEqual({
      backgroundImage: "url('/elsewhere/hero.jpg')"
    })
  })

  it('omits the second layer for a whitespace-only blur placeholder', () => {
    setImageCdnEnabledForTests(false)

    expect(getHeroSectionStyle('/elsewhere/hero.jpg', '   ')).toEqual({
      backgroundImage: "url('/elsewhere/hero.jpg')"
    })
  })

  it('omits the second layer for a malformed blur value that could break out of url(...)', () => {
    setImageCdnEnabledForTests(false)

    expect(
      getHeroSectionStyle(
        '/elsewhere/hero.jpg',
        "data:image/webp;base64,AAA');color:red;--x:('"
      )
    ).toEqual({
      backgroundImage: "url('/elsewhere/hero.jpg')"
    })
  })
})
