import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { normalizeRelativeLinksInDocumentData } from '@/utils'

type Model = NonNullable<
  Parameters<typeof normalizeRelativeLinksInDocumentData>[1]
>

const SRC_DIR = fileURLToPath(new URL('..', import.meta.url))

/**
 * Reads a model from the real schema JSON, so the fixtures exercise the
 * fields as the CMS declares them. Plugin models have no file here, so a media
 * value is passed through untouched. At runtime Strapi does return the upload
 * file model and its strings are normalized too, as before INTORG-1300: its
 * file `url` never gains a slash, and a save reads only the media `id`. Any
 * other unknown uid throws, so a typo in a fixture fails loudly.
 */
function getModel(uid: string): Model | undefined {
  if (uid.startsWith('plugin::')) return undefined
  const contentType = uid.match(/^api::([\w-]+)\.\1$/)?.[1]
  const file = contentType
    ? `api/${contentType}/content-types/${contentType}/schema.json`
    : `components/${uid.replace('.', '/')}.json`
  const { attributes } = JSON.parse(readFileSync(SRC_DIR + file, 'utf8'))
  return {
    uid,
    modelType: contentType ? 'contentType' : 'component',
    attributes
  }
}

function normalize(uid: string, data: Record<string, unknown>) {
  return normalizeRelativeLinksInDocumentData(data, getModel(uid), getModel)
}

describe('normalizeRelativeLinksInDocumentData', () => {
  it('normalizes a top-level pathSlug and a component link', async () => {
    expect(
      await normalize('api::profile-page.profile-page', {
        pathSlug: '/our-grantmaking',
        cta: { link: 'grant/apply' }
      })
    ).toEqual({ pathSlug: '/our-grantmaking/', cta: { link: '/grant/apply/' } })
  })

  it('stores an own-site URL in a link field relative and slashed', async () => {
    expect(
      await normalize('api::profile-page.profile-page', {
        cta: { link: 'https://interledger.org/es/blog' }
      })
    ).toEqual({ cta: { link: '/es/blog/' } })
    expect(
      await normalize('api::podcast-page.podcast-page', {
        podcasts: [{ url: 'https://staging.interledger.org/about' }]
      })
    ).toEqual({ podcasts: [{ url: '/about/' }] })
    expect(
      await normalize('api::redirect.redirect', {
        destination: 'https://interledger.org/blog'
      })
    ).toEqual({ destination: '/blog/' })
  })

  it('reduces an upload URL on the internal advert CTA, which sits two components deep', async () => {
    // The editor follows the Document Download helper text, presses Copy Link
    // in the Media Library, and pastes the absolute CMS origin. The advert
    // keeps its button in shared.secondary-cta-link inside a dynamic zone, so
    // the walker has to reach `link` two levels down (Anca, #706).
    const data = await normalize(
      'api::foundation-blog-post.foundation-blog-post',
      {
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
    )
    expect(data).toMatchObject({
      content: [
        {
          cta: { link: '/uploads/img/original/policy_blueprint_91f6021429.pdf' }
        }
      ]
    })
  })

  it('normalizes fields nested inside a single component', async () => {
    expect(
      await normalize('api::grant-page.grant-page', {
        ctaStrip: {
          primaryButtonLink: 'grant/apply',
          secondaryButtonLink: 'https://example.com'
        }
      })
    ).toEqual({
      ctaStrip: {
        primaryButtonLink: '/grant/apply/',
        secondaryButtonLink: 'https://example.com'
      }
    })
  })

  it('normalizes a quote block authorLink', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [
          { __component: 'blocks.quote', quote: 'Hi', authorLink: 'team' }
        ]
      })
    ).toEqual({
      content: [
        { __component: 'blocks.quote', quote: 'Hi', authorLink: '/team/' }
      ]
    })
  })

  it('normalizes a link component inside a dynamic zone', async () => {
    expect(
      await normalize('api::grant-page.grant-page', {
        content: [
          { __component: 'shared.cta-link', link: 'contact', text: 'Go' }
        ]
      })
    ).toEqual({
      content: [
        { __component: 'shared.cta-link', link: '/contact/', text: 'Go' }
      ]
    })
  })

  it('normalizes only the link fields of mixed dynamic-zone blocks', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [
          { __component: 'blocks.quote', quote: 'Hi', authorLink: '#section' },
          { __component: 'blocks.paragraph', content: 'Unrelated text' }
        ]
      })
    ).toEqual({
      content: [
        { __component: 'blocks.quote', quote: 'Hi', authorLink: '#section' },
        { __component: 'blocks.paragraph', content: 'Unrelated text' }
      ]
    })
  })

  it('normalizes fields nested inside repeatable components', async () => {
    expect(
      await normalize('api::foundation-blog-post.foundation-blog-post', {
        articleBio: [
          { author: 'A', link: 'about-us' },
          { author: 'B', link: 'mailto:info@interledger.org' }
        ]
      })
    ).toEqual({
      articleBio: [
        { author: 'A', link: '/about-us/' },
        { author: 'B', link: 'mailto:info@interledger.org' }
      ]
    })
  })

  // A related-article `slug` is a path segment like `pathSlug`.
  it('stores a related-article slug with both slashes', async () => {
    expect(
      await normalize('api::foundation-blog-post.foundation-blog-post', {
        relatedArticles: [{ slug: 'my-post' }, { slug: '/x/' }]
      })
    ).toEqual({ relatedArticles: [{ slug: '/my-post/' }, { slug: '/x/' }] })
  })

  it('leaves unrelated fields and non-string values untouched', async () => {
    const data = { title: 'Hello', draft: true, hero: null }
    expect(
      await normalize('api::foundation-page.foundation-page', data)
    ).toEqual(data)
  })

  it('reduces a media-library URL pasted into a link field to its path', async () => {
    expect(
      await normalize('api::profile-page.profile-page', {
        cta: {
          link: 'https://cms.example.org/uploads/img/original/report_a1b2.pdf'
        }
      })
    ).toEqual({ cta: { link: '/uploads/img/original/report_a1b2.pdf' } })
  })

  it('leaves an external video URL alone', async () => {
    const block = {
      __component: 'blocks.split-layout',
      videoUrl: 'https://www.youtube.com/watch?v=abc'
    }
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [block]
      })
    ).toEqual({ content: [block] })
  })

  // A URL missing its scheme is broken either way, but slashing it would
  // disguise it as an internal link.
  it('does not turn a scheme-less external URL into a site path', async () => {
    const block = {
      __component: 'blocks.split-layout',
      videoUrl: 'www.youtube.com/watch?v=abc123'
    }
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [block]
      })
    ).toEqual({ content: [block] })
    expect(
      await normalize('api::podcast-page.podcast-page', {
        podcasts: [{ url: 'twitter.com/interledger' }]
      })
    ).toEqual({ podcasts: [{ url: 'twitter.com/interledger' }] })
  })

  it('only cuts the origin of an upload in a URL field', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [
          {
            __component: 'blocks.split-layout',
            videoUrl: 'https://cms.example/uploads/img/original/clip.mp4'
          },
          {
            __component: 'blocks.video-embed',
            externalUrl: 'https://cms.example/uploads/img/original/clip.mp4'
          },
          {
            __component: 'blocks.pdf-embed',
            externalUrl: 'https://cms.example/uploads/img/original/a.pdf'
          }
        ]
      })
    ).toMatchObject({
      content: [
        { videoUrl: '/uploads/img/original/clip.mp4' },
        { externalUrl: '/uploads/img/original/clip.mp4' },
        { externalUrl: '/uploads/img/original/a.pdf' }
      ]
    })
    expect(
      await normalize('api::podcast-page.podcast-page', {
        podcasts: [{ url: 'https://cms.example/uploads/img/original/ep1.mp3' }]
      })
    ).toEqual({ podcasts: [{ url: '/uploads/img/original/ep1.mp3' }] })
  })

  it('does not mutate the data it is given', async () => {
    const data = { cta: { link: 'grant/apply' } }
    await normalize('api::profile-page.profile-page', data)
    expect(data).toEqual({ cta: { link: 'grant/apply' } })
  })
})

describe('normalizeRelativeLinksInDocumentData rich text', () => {
  const BARE_STAGING_BLOG = 'See https://staging.interledger.org/blog'
  const LINKED_STAGING_BLOG =
    'See [https://staging.interledger.org/blog](/blog/)'

  it('links a bare own-site URL in a top-level CKEditor field', async () => {
    expect(
      await normalize('api::grant-page.grant-page', {
        programOverview: BARE_STAGING_BLOG
      })
    ).toEqual({ programOverview: LINKED_STAGING_BLOG })
  })

  it('links a bare own-site URL in a CKEditor field in a dynamic zone', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [
          { __component: 'blocks.paragraph', content: BARE_STAGING_BLOG }
        ]
      })
    ).toEqual({
      content: [
        { __component: 'blocks.paragraph', content: LINKED_STAGING_BLOG }
      ]
    })
  })

  it('links a bare own-site URL in a CKEditor field in a component', async () => {
    expect(
      await normalize('api::grant-page.grant-page', {
        ctaStrip: { description: BARE_STAGING_BLOG }
      })
    ).toEqual({ ctaStrip: { description: LINKED_STAGING_BLOG } })
  })

  it('reads a CKEditor field in its runtime shape, with type richtext', async () => {
    const model: Model = {
      uid: 'api::runtime.runtime',
      modelType: 'contentType',
      attributes: {
        body: { type: 'richtext', customField: 'plugin::ckeditor5.CKEditor' }
      }
    }
    expect(
      await normalizeRelativeLinksInDocumentData(
        { body: BARE_STAGING_BLOG },
        model,
        getModel
      )
    ).toEqual({ body: LINKED_STAGING_BLOG })
  })

  it('keeps balanced parentheses whole through every pass', async () => {
    expect(
      await normalize('api::grant-page.grant-page', {
        programOverview:
          'See https://interledger.org/a_(b), [x](https://interledger.org/a_(b)) ' +
          'and [d](https://cms.example/uploads/img/original/a_(1).pdf)'
      })
    ).toEqual({
      programOverview:
        'See [https://interledger.org/a_(b)](/a_(b)/), [x](/a_(b)/) ' +
        'and [d](/uploads/img/original/a_(1).pdf)'
    })
  })

  it('only slashes a bare own-site URL in a plain field', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [{ __component: 'blocks.quote', quote: BARE_STAGING_BLOG }]
      })
    ).toEqual({
      content: [
        {
          __component: 'blocks.quote',
          quote: 'See https://staging.interledger.org/blog/'
        }
      ]
    })
  })

  it('strips the CMS origin from an image nested in a dynamic zone', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [
          {
            __component: 'blocks.paragraph',
            content:
              'Intro\n\n![Chart](http://localhost:1337/uploads/img/original/chart_a1.png)'
          }
        ]
      })
    ).toMatchObject({
      content: [
        { content: 'Intro\n\n![Chart](/uploads/img/original/chart_a1.png)' }
      ]
    })
  })

  it('slashes an internal link in a paragraph block', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [
          {
            __component: 'blocks.paragraph',
            content: 'Read [our grants](/grant/our-grantmaking).'
          }
        ]
      })
    ).toMatchObject({
      content: [{ content: 'Read [our grants](/grant/our-grantmaking/).' }]
    })
  })

  it('cuts the CMS origin from a pasted file link', async () => {
    expect(
      await normalize('api::grant-page.grant-page', {
        programOverview:
          '[file](https://cms.example/uploads/img/original/a.pdf)'
      })
    ).toEqual({ programOverview: '[file](/uploads/img/original/a.pdf)' })
  })

  it('makes an own-site link in a paragraph relative and slashed', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [
          {
            __component: 'blocks.paragraph',
            content: '[x](https://interledger.org/blog)'
          }
        ]
      })
    ).toMatchObject({ content: [{ content: '[x](/blog/)' }] })
  })

  it('leaves a code field alone', async () => {
    const block = {
      __component: 'blocks.code-block',
      code: 'fetch("https://cms.example/uploads/img/original/a.json") // https://interledger.org/x'
    }
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [block]
      })
    ).toEqual({ content: [block] })
  })

  it('passes a media value through alongside a normalized link', async () => {
    expect(
      await normalize('api::foundation-blog-post.foundation-blog-post', {
        featureImageMobile: 5,
        articleBio: [{ link: 'https://interledger.org/about' }]
      })
    ).toEqual({ featureImageMobile: 5, articleBio: [{ link: '/about/' }] })
  })

  it('passes a null dynamic-zone item through', async () => {
    expect(
      await normalize('api::foundation-page.foundation-page', {
        content: [null]
      })
    ).toEqual({ content: [null] })
  })

  it('returns data without a schema as is', async () => {
    const data = { link: 'https://interledger.org/blog' }
    expect(
      await normalizeRelativeLinksInDocumentData(data, undefined, getModel)
    ).toBe(data)
  })
})
