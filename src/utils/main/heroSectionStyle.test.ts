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
})
