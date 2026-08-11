import { afterEach, describe, expect, it } from 'vitest'
import { setImageCdnEnabledForTests } from './images'
import { getHeroSectionStyle } from './heroSectionStyle'

afterEach(() => {
  setImageCdnEnabledForTests(null)
})

describe('getHeroSectionStyle', () => {
  it('keeps CDN URLs unchanged', () => {
    setImageCdnEnabledForTests(true)

    expect(getHeroSectionStyle('/img/hero image.jpg')).toEqual({
      backgroundImage:
        "url('/.netlify/images?url=%2Fimg%2Fhero+image.jpg&fm=webp&w=3840&q=90')"
    })
  })

  it('still escapes a raw fallback path when no optimized URL exists', () => {
    setImageCdnEnabledForTests(false)

    expect(getHeroSectionStyle('/elsewhere/hero image.jpg')).toEqual({
      backgroundImage: "url('/elsewhere/hero%20image.jpg')"
    })
  })
})