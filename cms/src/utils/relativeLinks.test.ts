import { describe, it, expect } from 'vitest'
import {
  bareSlug,
  isSameSlug,
  slugVariants,
  toSlashedPath,
  toSlashedSlug,
  slashInternalMarkdownLinks,
  stripUploadOrigin,
  stripSiteOriginsInText,
  stripUploadOriginsInText,
  toStoredHref
} from '@/utils'
import { SITE_HOSTS } from './relativeLinks'

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
    expect(toSlashedPath('/audio/episode.mp3')).toBe('/audio/episode.mp3')
  })

  it('slashes a page whose slug ends in a dot and digits', () => {
    expect(toSlashedPath('/blog/what-is-web3.0')).toBe('/blog/what-is-web3.0/')
    expect(toSlashedPath('/release/1.2.3#notes')).toBe('/release/1.2.3/#notes')
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

describe('toStoredHref', () => {
  it.each(SITE_HOSTS)('stores a %s URL relative and slashed', (host) => {
    expect(toStoredHref(`https://${host}/es/blog`)).toBe('/es/blog/')
    expect(toStoredHref(`${host}/es/blog`)).toBe('/es/blog/')
  })

  it('matches the scheme and host in any case', () => {
    expect(toStoredHref('HTTP://Staging.Interledger.org/about')).toBe('/about/')
  })

  it('stores the origin alone as the root', () => {
    expect(toStoredHref('https://interledger.org')).toBe('/')
    expect(toStoredHref('interledger.org')).toBe('/')
  })

  it('keeps the query and fragment after the slash', () => {
    expect(toStoredHref('https://interledger.org/about?x=1#team')).toBe(
      '/about/?x=1#team'
    )
  })

  it('collapses a double slash after the host', () => {
    expect(toStoredHref('https://interledger.org//blog/x')).toBe('/blog/x/')
  })

  it('trims surrounding whitespace', () => {
    expect(toStoredHref('  https://interledger.org/x  ')).toBe('/x/')
  })

  it('still reduces an upload URL to its file path', () => {
    expect(toStoredHref('https://cms.example/uploads/img/original/a.pdf')).toBe(
      '/uploads/img/original/a.pdf'
    )
  })

  it.each(['https://community.interledger.org/x', 'https://example.com/x'])(
    'leaves %j unchanged',
    (value) => {
      expect(toStoredHref(value)).toBe(value)
    }
  )

  it('does not read a scheme-less subdomain as our site', () => {
    const value = 'community.interledger.org/x'
    expect(toStoredHref(value)).toBe(toSlashedPath(value))
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

describe('slashInternalMarkdownLinks', () => {
  it('slashes an internal link, keeping a fragment or query after it', () => {
    expect(
      slashInternalMarkdownLinks(
        'See [about](/about), [team](/about#team) and [blog](/blog?tag=x).'
      )
    ).toBe(
      'See [about](/about/), [team](/about/#team) and [blog](/blog/?tag=x).'
    )
  })

  it('slashes after balanced parentheses, not inside them', () => {
    expect(
      slashInternalMarkdownLinks('[x](/a_(b)) and [y](/(a)(b)?c=(d))')
    ).toBe('[x](/a_(b)/) and [y](/(a)(b)/?c=(d))')
  })

  it.each([
    '[ext](https://example.org/x)',
    '[proto](//example.org/x)',
    '[anchor](#top)',
    '[mail](mailto:a@b.org)',
    '![chart](/img/blog/chart.png)',
    '[report](/uploads/img/original/report.pdf)',
    '[report](/uploads/img/original/report_(1).pdf)',
    '[done](/about/)'
  ])('leaves %s alone', (text) => {
    expect(slashInternalMarkdownLinks(text)).toBe(text)
  })

  // A code span closes on a backtick run of its own length, and a fence on
  // its own run of three or more backticks or tildes.
  it.each([
    'Use ``[x](/api)`` here',
    'Use ``a `tick` [x](/api)`` here',
    '````md\n```\n[y](/api)\n```\n````',
    '~~~~\n[y](/api)\n~~~~'
  ])('leaves code in %j alone', (text) => {
    expect(slashInternalMarkdownLinks(text)).toBe(text)
  })

  it('rewrites prose between and after code spans of different lengths', () => {
    expect(
      slashInternalMarkdownLinks('``[a](/x)`` [b](/y) `[c](/z)` [d](/w)')
    ).toBe('``[a](/x)`` [b](/y/) `[c](/z)` [d](/w/)')
  })

  // An unmatched backtick is a literal character, not the start of code.
  it('treats a lone backtick as prose', () => {
    expect(slashInternalMarkdownLinks('a ` b [c](/x)')).toBe('a ` b [c](/x/)')
  })

  it('leaves links in code spans and fenced blocks alone', () => {
    const text =
      'Use `[x](/api)` like this:\n\n```md\n[y](/api)\n```\n\nthen [z](/api).'
    expect(slashInternalMarkdownLinks(text)).toBe(
      'Use `[x](/api)` like this:\n\n```md\n[y](/api)\n```\n\nthen [z](/api/).'
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

  it('reduces a Markdown link target after a space', () => {
    expect(
      stripUploadOriginsInText(
        '[Guide]( http://localhost:1337/uploads/img/original/guide_b2.pdf)'
      )
    ).toBe('[Guide]( /uploads/img/original/guide_b2.pdf)')
  })

  it('ends a URL at a table cell pipe', () => {
    expect(
      stripUploadOriginsInText(
        '|http://localhost:1337/uploads/img/original/a.pdf|'
      )
    ).toBe('|[/uploads/img/original/a.pdf](/uploads/img/original/a.pdf)|')
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

  it('cuts the origin in a reference definition with no space after the colon', () => {
    expect(
      stripUploadOriginsInText(
        '[guide]:https://cms.example/uploads/img/original/a.pdf'
      )
    ).toBe('[guide]:/uploads/img/original/a.pdf')
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

  it('leaves an upload URL nested in another URL’s fragment', () => {
    const text =
      '[a](https://example.com/#https://cms.example/uploads/img/original/a.pdf)'
    expect(stripUploadOriginsInText(text)).toBe(text)
  })

  it('keeps balanced parentheses in a bare upload URL', () => {
    expect(
      stripUploadOriginsInText(
        'See https://cms.example/uploads/img/original/a_(1).pdf now'
      )
    ).toBe(
      'See [/uploads/img/original/a_(1).pdf](/uploads/img/original/a_(1).pdf) now'
    )
  })

  it('links a bare upload URL in a footnote, as in prose', () => {
    expect(
      stripUploadOriginsInText(
        '[^1]: https://cms.example/uploads/img/original/a.pdf'
      )
    ).toBe('[^1]: [/uploads/img/original/a.pdf](/uploads/img/original/a.pdf)')
  })

  it('reduces an upload URL in an unquoted HTML attribute', () => {
    expect(
      stripUploadOriginsInText(
        '<img src=https://cms.example/uploads/img/original/a.png>'
      )
    ).toBe('<img src=/uploads/img/original/a.png>')
  })

  it('reduces a srcset entry after a comma and a space', () => {
    expect(
      stripUploadOriginsInText(
        '<img srcset="/a.png 500w, https://cms.example/uploads/img/original/b.png 1000w">'
      )
    ).toBe('<img srcset="/a.png 500w, /uploads/img/original/b.png 1000w">')
  })

  it('only cuts the origin of an upload URL in attribute prose', () => {
    expect(
      stripUploadOriginsInText(
        '<img title="see https://cms.example/uploads/img/original/a.png">'
      )
    ).toBe('<img title="see /uploads/img/original/a.png">')
  })

  it('leaves an upload URL nested in another URL inside an HTML attribute', () => {
    const text =
      '<img src="https://proxy.example/?u=https://cms.example/uploads/img/original/a.png">'
    expect(stripUploadOriginsInText(text)).toBe(text)
  })
})

describe('stripSiteOriginsInText in plain text', () => {
  const stripPlainText = (text: string) =>
    stripSiteOriginsInText(text, 'plainText')

  it('makes the ticket’s link target relative', () => {
    expect(
      stripPlainText(
        '[View insights from the 2025 cycle](https://interledger.org/blog/call-papers-program/).'
      )
    ).toBe('[View insights from the 2025 cycle](/blog/call-papers-program/).')
  })

  it('slashes the relative link target', () => {
    expect(stripPlainText('[a](https://interledger.org/grant)')).toBe(
      '[a](/grant/)'
    )
  })

  it('handles an angle-bracket destination', () => {
    expect(
      stripPlainText(
        '[a](<https://staging.interledger.org/grant/our-grantmaking>)'
      )
    ).toBe('[a](</grant/our-grantmaking/>)')
  })

  it('handles a destination after spaces, which Markdown allows', () => {
    expect(stripPlainText('[a]( https://interledger.org/grant )')).toBe(
      '[a]( /grant/ )'
    )
    expect(stripPlainText('[a](  <https://interledger.org/grant>)')).toBe(
      '[a](  </grant/>)'
    )
  })

  it('ends a URL at a table cell pipe', () => {
    expect(stripPlainText('|https://interledger.org/x|')).toBe(
      '|https://interledger.org/x/|'
    )
  })

  it('collapses a doubled slash after the host', () => {
    expect(stripPlainText('[a](https://interledger.org//blog/x)')).toBe(
      '[a](/blog/x/)'
    )
  })

  it('keeps a Markdown-escaped path byte for byte', () => {
    expect(stripPlainText('[a](https://interledger.org/a\\_b)')).toBe(
      '[a](/a\\_b/)'
    )
  })

  it('keeps the URL as link text, so links never nest', () => {
    expect(
      stripPlainText('[https://interledger.org](https://interledger.org)')
    ).toBe('[https://interledger.org](/)')
  })

  it('turns an autolink into an explicit relative link', () => {
    expect(stripPlainText('<https://interledger.org/x>')).toBe(
      '[https://interledger.org/x](/x/)'
    )
  })

  it('slashes a bare URL in place, before sentence punctuation', () => {
    expect(stripPlainText('Visit https://staging.interledger.org/blog.')).toBe(
      'Visit https://staging.interledger.org/blog/.'
    )
  })

  it('slashes a bare URL in CKEditor italics, keeping the emphasis', () => {
    expect(stripPlainText('_https://interledger.org/blog_')).toBe(
      '_https://interledger.org/blog/_'
    )
  })

  it('slashes a bare scheme-less www. URL, which GFM autolinks', () => {
    expect(stripPlainText('Visit www.interledger.org/es/blog now')).toBe(
      'Visit www.interledger.org/es/blog/ now'
    )
  })

  it('makes a scheme-less link target relative, for every host', () => {
    expect(stripPlainText('[a](staging.interledger.org/x)')).toBe('[a](/x/)')
    expect(stripPlainText('[a](www.interledger.org/x)')).toBe('[a](/x/)')
  })

  it('slashes a URL in a footnote in place, as prose', () => {
    expect(stripPlainText('[^4]: https://interledger.org/blog/x')).toBe(
      '[^4]: https://interledger.org/blog/x/'
    )
  })

  it.each([
    'Visit https://interledger.org now',
    'https://interledger.org/img/a.png',
    'https://community.interledger.org/x',
    '?u=https://interledger.org/x',
    '[a](https://example.com/#https://interledger.org/x)',
    '`https://interledger.org/x`',
    'Visit interledger.org/es/blog now',
    'programteam@interledger.org',
    '[x](mailto:programteam@interledger.org)',
    'hackathon @ interledger.org',
    '<a href="mailto:programteam@interledger.org">',
    '<CtaStrip primaryButtonLink="https://podcast.interledger.org/@futuremoneypodcast/episodes/x">',
    '<a title="see https://interledger.org/x">',
    '<a title="Hello, https://interledger.org/x">',
    // An attribute value that is not a link, even one that starts with a URL.
    '<a title="https://interledger.org/x">',
    '<img alt="interledger.org logo">',
    '<interledger.org/x>',
    // Our host as the userinfo of another host.
    'https://interledger.org@evil.com/x'
  ])('leaves %s unchanged', (text) => {
    expect(stripPlainText(text)).toBe(text)
  })

  it('keeps balanced parentheses in a URL, as GFM and CommonMark do', () => {
    expect(stripPlainText('See https://interledger.org/a_(b) now')).toBe(
      'See https://interledger.org/a_(b)/ now'
    )
    expect(stripPlainText('[x](https://interledger.org/a_(b))')).toBe(
      '[x](/a_(b)/)'
    )
    expect(stripPlainText('(see https://interledger.org/a_(b))')).toBe(
      '(see https://interledger.org/a_(b)/)'
    )
  })

  it('makes an unquoted HTML attribute target relative', () => {
    expect(stripPlainText('<a href=https://interledger.org/x>')).toBe(
      '<a href=/x/>'
    )
  })

  it('is idempotent', () => {
    const once = stripPlainText(
      '[a](https://interledger.org/grant) and https://staging.interledger.org/blog. ' +
        '<https://interledger.org/x>'
    )
    expect(stripPlainText(once)).toBe(once)
  })
})

describe('stripSiteOriginsInText in rich text', () => {
  const stripRichText = (text: string) =>
    stripSiteOriginsInText(text, 'richText')

  it('links a bare origin', () => {
    expect(
      stripRichText('Read more on our https://interledger.org website')
    ).toBe('Read more on our [https://interledger.org](/) website')
  })

  it('links a URL in a table cell, without its pipe', () => {
    expect(stripRichText('|https://interledger.org/x|')).toBe(
      '|[https://interledger.org/x](/x/)|'
    )
  })

  it('links a bare URL, before sentence punctuation', () => {
    expect(stripRichText('Visit https://interledger.org/blog.')).toBe(
      'Visit [https://interledger.org/blog](/blog/).'
    )
  })

  it('links a bare URL in italics, keeping the emphasis', () => {
    expect(stripRichText('See _https://interledger.org_ now')).toBe(
      'See _[https://interledger.org](/)_ now'
    )
  })

  it('links a bare scheme-less www. URL', () => {
    expect(stripRichText('Visit www.interledger.org/es/blog.')).toBe(
      'Visit [www.interledger.org/es/blog](/es/blog/).'
    )
  })

  it('links a URL in a footnote', () => {
    expect(stripRichText('[^4]: https://interledger.org/blog/x')).toBe(
      '[^4]: [https://interledger.org/blog/x](/blog/x/)'
    )
  })

  it('links a bare URL with balanced parentheses whole', () => {
    expect(stripRichText('See https://interledger.org/a_(b) now')).toBe(
      'See [https://interledger.org/a_(b)](/a_(b)/) now'
    )
  })

  it('makes a link attribute relative and leaves alt text alone', () => {
    expect(
      stripRichText(
        '<img src="https://interledger.org/a.png" alt="interledger.org">'
      )
    ).toBe('<img src="/a.png" alt="interledger.org">')
  })

  it('makes a link target relative, as in plain text', () => {
    expect(stripRichText('[a](https://interledger.org/grant)')).toBe(
      '[a](/grant/)'
    )
  })

  it.each([
    'Email programteam@interledger.org',
    'hackathon @ interledger.org',
    'Visit interledger.org now',
    '[a](https://example.com/#https://interledger.org/x)',
    '[https://interledger.org](/)',
    // Another host that merely starts with ours, or a port.
    'See https://interledger.org.evil.com/x',
    '[a](https://interledger.org.evil.com/x)',
    'See https://interledger.organization.com',
    'See https://interledger.org:8080/x',
    'See https://interledger.org@evil.com/x'
  ])('leaves %s unchanged', (text) => {
    expect(stripRichText(text)).toBe(text)
  })

  it('is idempotent', () => {
    const once = stripRichText(
      'Visit https://interledger.org/blog. or _https://interledger.org_'
    )
    expect(stripRichText(once)).toBe(once)
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
