import { describe, expect, it } from 'vitest'
import { relatedArticlePathSlug } from './relatedArticlePathSlug'

// Same values as the "related article segment" cases in
// cms/src/utils/relativeLinks.test.ts.
const cases: [string, string][] = [
  ['/blog/my-post/', 'my-post'],
  ['/blog/Interledger-Universe/', 'interledger-universe'],
  ['Interledger-Universe', 'interledger-universe'],
  ['/blog/my-post', 'my-post'],
  ['/blog/what-is-web3.0/', 'what-is-web3.0'],
  ['/blog/a_b~c.d-e1/', 'a_b~c.d-e1'],
  ['my-post', 'my-post'],
  ['/grant/foo/', 'grant/foo'],
  ['/blog/my post/', 'blog/my post'],
  ['/blog/café/', 'blog/café']
]

describe('relatedArticlePathSlug', () => {
  it.each(cases)('reads %j as %j', (value, slug) => {
    expect(relatedArticlePathSlug(value)).toBe(slug)
  })
})
