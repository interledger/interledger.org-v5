import { describe, it, expect } from 'vitest'
import {
  bareSlug,
  isSameSlug,
  slugVariants,
  toSlashedPath,
  toSlashedSlug,
  normalizeRelativeLinksInDocumentData,
  stripUploadOrigin,
  stripUploadOriginsInText
} from '@/utils'

describe('toSlashedPath', () => {
  it.each([
    ['grant/our-grantmaking', '/grant/our-grantmaking/'],
    ['/grant/our-grantmaking', '/grant/our-grantmaking/'],
    ['/grant/our-grantmaking/', '/grant/our-grantmaking/'],
    ['  /about  ', '/about/'],
    ['/about//team', '/about/team/'],
    ['/', '/']
  ])('stores the internal path %j as %j', (input, expected) => {
    expect(toSlashedPath(input)).toBe(expected)
  })

  it('puts the trailing slash before a query or a fragment', () => {
    expect(toSlashedPath('/blog?tag=news')).toBe('/blog/?tag=news')
    expect(toSlashedPath('/about#team')).toBe('/about/#team')
    expect(toSlashedPath('/about/#team')).toBe('/about/#team')
  })

  it('never leaves a script-bearing scheme runnable', () => {
    expect(toSlashedPath('javascript:alert(1)')).toMatch(/^\//)
    expect(toSlashedPath('JavaScript:alert(1)')).toMatch(/^\//)
    expect(toSlashedPath('data:text/html,hi')).toMatch(/^\//)
  })

  it('leaves a link to a file without a trailing slash', () => {
    expect(toSlashedPath('/uploads/img/original/report.pdf')).toBe(
      '/uploads/img/original/report.pdf'
    )
    expect(toSlashedPath('uploads/a.png?v=2')).toBe('/uploads/a.png?v=2')
  })

  it.each([
    'http://example.com',
    'https://example.com/path',
    '//example.com',
    'mailto:info@interledger.org',
    'tel:+123456',
    'ftp://example.com/file',
    'sms:+123456',
    'HTTPS://EXAMPLE.COM/x',
    '#section',
    // The donation card's Fundraise Up element id.
    '#XVSHSPQU',
    ''
  ])('leaves %j unchanged', (value) => {
    expect(toSlashedPath(value)).toBe(value)
  })
})

describe('toSlashedSlug', () => {
  it.each([
    ['our-grantmaking', '/our-grantmaking/'],
    ['/our-grantmaking', '/our-grantmaking/'],
    ['our-grantmaking/', '/our-grantmaking/'],
    ['/our-grantmaking/', '/our-grantmaking/'],
    ['education/on-campus', '/education/on-campus/'],
    [' /our-grantmaking ', '/our-grantmaking/']
  ])('stores %j as %j', (input, expected) => {
    expect(toSlashedSlug(input)).toBe(expected)
  })

  // An empty slug is the `required` validator's to report, not `//`.
  it.each(['', '/', '  '])('leaves %j empty', (value) => {
    expect(toSlashedSlug(value)).toBe('')
  })
})

// Stored slugs move from `about` to `/about/` (INTORG-1254). These are how
// two slugs are compared while both forms exist.
describe('bareSlug', () => {
  it.each([
    ['about', 'about'],
    ['/about', 'about'],
    ['about/', 'about'],
    ['/about/', 'about'],
    ['//about//', 'about'],
    [' /grant/education/ ', 'grant/education'],
    ['/', ''],
    ['', '']
  ])('reduces %j to %j', (input, expected) => {
    expect(bareSlug(input)).toBe(expected)
  })
})

describe('isSameSlug', () => {
  it('treats the bare and the slashed form as one slug', () => {
    expect(isSameSlug('about', '/about/')).toBe(true)
    expect(isSameSlug('/grant/education', 'grant/education/')).toBe(true)
  })

  it('tells different slugs apart', () => {
    expect(isSameSlug('about', '/about-us/')).toBe(false)
    expect(isSameSlug('grant/education', 'education')).toBe(false)
  })
})

describe('slugVariants', () => {
  it('lists the bare and the slashed form, whichever form it gets', () => {
    expect(slugVariants('about')).toEqual(['about', '/about/'])
    expect(slugVariants('/about/')).toEqual(['about', '/about/'])
    expect(slugVariants('grant/education')).toEqual([
      'grant/education',
      '/grant/education/'
    ])
  })
})

describe('normalizeRelativeLinksInDocumentData', () => {
  it('normalizes a top-level pathSlug and href-like field', () => {
    const data = { pathSlug: '/our-grantmaking', link: 'grant/apply' }
    normalizeRelativeLinksInDocumentData(data)
    expect(data).toEqual({
      pathSlug: '/our-grantmaking/',
      link: '/grant/apply/'
    })
  })

  it('reduces an upload URL on the internal advert CTA, which sits two components deep', () => {
    // The editor follows the Document Download helper text, presses Copy Link
    // in the Media Library, and pastes the absolute CMS origin. The advert
    // keeps its button in shared.secondary-cta-link inside a dynamic zone, so
    // the walker has to reach `link` two levels down (Anca, #706).
    const data = {
      content: [
        {
          __component: 'blocks.internal-advert',
          cta: {
            text: 'Read the report',
            link: 'http://localhost:1337/uploads/img/original/policy_blueprint_91f6021429.pdf',
            document: true
          }
        }
      ]
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.content[0].cta.link).toBe(
      '/uploads/img/original/policy_blueprint_91f6021429.pdf'
    )
  })

  it('normalizes fields nested inside a single component', () => {
    const data = {
      ctaStrip: {
        primaryButtonLink: 'grant/apply',
        secondaryButtonLink: 'https://example.com'
      }
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.ctaStrip).toEqual({
      primaryButtonLink: '/grant/apply/',
      secondaryButtonLink: 'https://example.com'
    })
  })

  it('normalizes a quote block authorLink', () => {
    const data = {
      content: [
        {
          __component: 'blocks.quote',
          quote: 'Hi',
          authorLink: 'team'
        }
      ]
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.content).toEqual([
      { __component: 'blocks.quote', quote: 'Hi', authorLink: '/team/' }
    ])
  })

  it('normalizes fields nested inside a dynamic-zone array', () => {
    const data = {
      content: [
        { __component: 'shared.cta-link', link: 'contact', text: 'Go' },
        { __component: 'blocks.quote', quote: 'Hi', authorLink: '#section' },
        { __component: 'blocks.paragraph', content: 'Unrelated text' }
      ]
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.content).toEqual([
      { __component: 'shared.cta-link', link: '/contact/', text: 'Go' },
      { __component: 'blocks.quote', quote: 'Hi', authorLink: '#section' },
      { __component: 'blocks.paragraph', content: 'Unrelated text' }
    ])
  })

  it('normalizes fields nested inside repeatable components', () => {
    const data = {
      mainMenu: [
        { label: 'A', href: 'about-us' },
        { label: 'B', href: 'mailto:info@interledger.org' }
      ]
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.mainMenu).toEqual([
      { label: 'A', href: '/about-us/' },
      { label: 'B', href: 'mailto:info@interledger.org' }
    ])
  })

  // A related-article `slug` is a path segment like `pathSlug`.
  it('stores a related-article slug with both slashes', () => {
    const data = { relatedArticles: [{ slug: 'my-post' }, { slug: '/x/' }] }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.relatedArticles).toEqual([
      { slug: '/my-post/' },
      { slug: '/x/' }
    ])
  })

  it('leaves unrelated fields and non-string values untouched', () => {
    const data = {
      title: 'Hello',
      required: true,
      count: 3,
      media: null
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data).toEqual({
      title: 'Hello',
      required: true,
      count: 3,
      media: null
    })
  })

  it('reduces a media-library URL pasted into a link field to its path', () => {
    const data = {
      link: 'https://cms.example.org/uploads/img/original/report_a1b2.pdf'
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data).toEqual({ link: '/uploads/img/original/report_a1b2.pdf' })
  })
})

describe('normalizeRelativeLinksInDocumentData rich text', () => {
  it('strips the CMS origin from an image nested in a dynamic zone', () => {
    const data = {
      content: [
        {
          __component: 'blocks.paragraph',
          content:
            'Intro\n\n![Chart](http://localhost:1337/uploads/img/original/chart_a1.png)'
        }
      ]
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.content[0].content).toBe(
      'Intro\n\n![Chart](/uploads/img/original/chart_a1.png)'
    )
  })
  it('only cuts the origin in a single-URL field', () => {
    const data = {
      url: 'https://cms.example/uploads/img/original/clip.mp4',
      videoUrl: 'https://cms.example/uploads/img/original/clip.mp4',
      externalUrl: 'https://cms.example/uploads/img/original/a.pdf'
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data).toEqual({
      url: '/uploads/img/original/clip.mp4',
      videoUrl: '/uploads/img/original/clip.mp4',
      externalUrl: '/uploads/img/original/a.pdf'
    })
  })

  it('leaves a code field alone', () => {
    const data = {
      __component: 'blocks.code-block',
      code: 'fetch("https://cms.example/uploads/img/original/a.json")'
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.code).toBe(
      'fetch("https://cms.example/uploads/img/original/a.json")'
    )
  })
})

describe('stripUploadOriginsInText', () => {
  it('reduces a Markdown image target', () => {
    expect(
      stripUploadOriginsInText(
        '![A chart](https://strapi-admin.interledger.org/uploads/img/original/chart_a1.png)'
      )
    ).toBe('![A chart](/uploads/img/original/chart_a1.png)')
  })

  it('reduces a Markdown link target and keeps its title', () => {
    expect(
      stripUploadOriginsInText(
        '[Guide](http://localhost:1337/uploads/img/original/guide_b2.pdf "Guide PDF")'
      )
    ).toBe('[Guide](/uploads/img/original/guide_b2.pdf "Guide PDF")')
  })

  it('reduces an HTML src and every srcset entry', () => {
    expect(
      stripUploadOriginsInText(
        '<img src="http://localhost:1337/uploads/img/original/a.png" ' +
          'srcset="http://localhost:1337/uploads/img/original/small_a.png 500w,http://localhost:1337/uploads/img/original/a.png 1000w">'
      )
    ).toBe(
      '<img src="/uploads/img/original/a.png" ' +
        'srcset="/uploads/img/original/small_a.png 500w,/uploads/img/original/a.png 1000w">'
    )
  })

  it('reduces every URL in one string, whatever the origin', () => {
    expect(
      stripUploadOriginsInText(
        '![A](http://localhost:1337/uploads/img/original/a.png) and ' +
          '[B](https://strapi-admin.interledger.org/uploads/img/original/b.pdf?v=2#page=3)'
      )
    ).toBe(
      '![A](/uploads/img/original/a.png) and [B](/uploads/img/original/b.pdf?v=2#page=3)'
    )
  })

  it('turns a bare URL in prose into an explicit relative link', () => {
    expect(
      stripUploadOriginsInText(
        'Download https://strapi-admin.interledger.org/uploads/img/original/guide.pdf.'
      )
    ).toBe(
      'Download [/uploads/img/original/guide.pdf](/uploads/img/original/guide.pdf).'
    )
  })

  it('turns an autolink into an explicit relative link', () => {
    expect(
      stripUploadOriginsInText(
        'Get <https://cms.example/uploads/img/original/guide.pdf> now'
      )
    ).toBe(
      'Get [/uploads/img/original/guide.pdf](/uploads/img/original/guide.pdf) now'
    )
  })

  it('only cuts the origin in link text, so links never nest', () => {
    expect(
      stripUploadOriginsInText(
        '[https://cms.example/uploads/img/original/a.pdf](https://cms.example/uploads/img/original/a.pdf)'
      )
    ).toBe('[/uploads/img/original/a.pdf](/uploads/img/original/a.pdf)')
  })

  it('only cuts the origin in a reference definition', () => {
    expect(
      stripUploadOriginsInText(
        '[guide]: https://cms.example/uploads/img/original/a.pdf'
      )
    ).toBe('[guide]: /uploads/img/original/a.pdf')
  })

  it('links a field that is a bare URL alone, since it may be rich text', () => {
    expect(
      stripUploadOriginsInText(
        ' https://cms.example/uploads/img/original/a.pdf '
      )
    ).toBe(' [/uploads/img/original/a.pdf](/uploads/img/original/a.pdf) ')
  })

  it('links an italic bare URL, keeping the emphasis', () => {
    expect(
      stripUploadOriginsInText(
        'See _https://cms.example/uploads/img/original/a_b1.pdf_ now'
      )
    ).toBe(
      'See _[/uploads/img/original/a_b1.pdf](/uploads/img/original/a_b1.pdf)_ now'
    )
  })

  it('treats an escaped bracket or angle as prose', () => {
    expect(
      stripUploadOriginsInText(
        'a \\<b then https://cms.example/uploads/img/original/a.pdf'
      )
    ).toBe(
      'a \\<b then [/uploads/img/original/a.pdf](/uploads/img/original/a.pdf)'
    )
    expect(
      stripUploadOriginsInText(
        'Array \\[0 see https://cms.example/uploads/img/original/a.pdf'
      )
    ).toBe(
      'Array \\[0 see [/uploads/img/original/a.pdf](/uploads/img/original/a.pdf)'
    )
  })

  it('ends a bare URL at a closing bracket', () => {
    expect(
      stripUploadOriginsInText(
        '(see https://cms.example/uploads/img/original/a.pdf])'
      )
    ).toBe('(see [/uploads/img/original/a.pdf](/uploads/img/original/a.pdf)])')
  })

  it('leaves external URLs whose query or fragment mentions the upload path', () => {
    for (const text of [
      '[Guide](https://example.org?file=/uploads/img/original/guide.pdf)',
      '[Guide](https://example.org#/uploads/img/original/guide.pdf)',
      '[Old](https://example.org/foo/uploads/img/original/a.pdf)'
    ]) {
      expect(stripUploadOriginsInText(text)).toBe(text)
    }
  })

  it('leaves an upload URL nested inside another URL', () => {
    for (const text of [
      'https://web.archive.org/web/2020/https://interledger.org/uploads/img/original/a.pdf',
      '[P](https://proxy.example/?url=https://cms.example/uploads/img/original/a.pdf)',
      'xhttps://cms.example/uploads/img/original/a.pdf'
    ]) {
      expect(stripUploadOriginsInText(text)).toBe(text)
    }
  })

  it('leaves code spans and fenced blocks alone', () => {
    const text =
      'Run `curl https://cms.example/uploads/img/original/a.pdf` or\n\n' +
      '```sh\ncurl https://cms.example/uploads/img/original/b.pdf\n```'
    expect(stripUploadOriginsInText(text)).toBe(text)
  })

  it('leaves a path in another case alone, like stripUploadOrigin', () => {
    const text = '![A](https://cms.example/UPLOADS/IMG/ORIGINAL/a.png)'
    expect(stripUploadOriginsInText(text)).toBe(text)
  })

  it('keeps a Markdown-escaped filename byte for byte', () => {
    expect(
      stripUploadOriginsInText(
        '[Guide](https://strapi-admin.interledger.org/uploads/img/original/Survival\\_Guide\\_EN.pdf)'
      )
    ).toBe('[Guide](/uploads/img/original/Survival\\_Guide\\_EN.pdf)')
  })

  it('leaves external links, including external uploads paths, alone', () => {
    const text =
      '[GSMA](https://www.gsma.com/wp-content/uploads/report.pdf) and https://example.com/grants'
    expect(stripUploadOriginsInText(text)).toBe(text)
  })

  it('leaves relative paths alone and is idempotent', () => {
    const text = '![A](/uploads/img/original/a.png)'
    expect(stripUploadOriginsInText(text)).toBe(text)
    const once = stripUploadOriginsInText(
      '![A](http://localhost:1337/uploads/img/original/a.png)'
    )
    expect(stripUploadOriginsInText(once)).toBe(once)
  })
})

describe('stripUploadOrigin', () => {
  it('reduces an absolute upload URL to its path', () => {
    expect(
      stripUploadOrigin(
        'http://localhost:1338/uploads/img/original/report_a1b2.pdf'
      )
    ).toBe('/uploads/img/original/report_a1b2.pdf')
  })

  it('keeps a query string and a fragment', () => {
    expect(
      stripUploadOrigin(
        'https://cms.example.org/uploads/img/original/a.pdf?v=2#page=3'
      )
    ).toBe('/uploads/img/original/a.pdf?v=2#page=3')
  })

  it('leaves an already relative path alone', () => {
    expect(stripUploadOrigin('/uploads/img/original/a.pdf')).toBe(
      '/uploads/img/original/a.pdf'
    )
  })

  it('leaves an external link that happens to use an uploads path alone', () => {
    const href = 'https://example.com/uploads/report.pdf'
    expect(stripUploadOrigin(href)).toBe(href)
  })

  it('leaves an ordinary external link alone', () => {
    const href = 'https://example.com/grants'
    expect(stripUploadOrigin(href)).toBe(href)
  })

  it('leaves mailto and tel alone', () => {
    expect(stripUploadOrigin('mailto:hi@example.com')).toBe(
      'mailto:hi@example.com'
    )
    expect(stripUploadOrigin('tel:+15551234')).toBe('tel:+15551234')
  })

  it('leaves a malformed URL alone rather than throwing', () => {
    expect(stripUploadOrigin('https://')).toBe('https://')
  })
})
