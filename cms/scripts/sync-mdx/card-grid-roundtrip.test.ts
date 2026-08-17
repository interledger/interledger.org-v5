import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/card-grid.serializer'

import './cardGridHandler'

describe('CardGrid round-trip (serialize → parse)', () => {
  it('round-trips Title', async () => {
    const original = {
      ariaLabel: 'Grant options',
      variant: 'Title' as const,
      columns: 'Two' as const,
      titleCards: [
        {
          heading: 'Grant heading',
          description: '- Review eligibility\n- Prepare your proposal',
          secondaryCta: {
            link: '/grants/apply',
            text: 'Learn more',
            external: false,
            document: false
          }
        }
      ]
    }

    const mdx = serialize({ ...original })
    const blocks = await parseMdxToBlocks(mdx, { locale: 'en' })
    expect(blocks).toEqual([{ __component: 'blocks.card-grid', ...original }])
  })

  it('round-trips an optional title', async () => {
    const original = {
      title: 'Why Participate?',
      ariaLabel: 'Reasons to participate',
      variant: 'Info' as const,
      columns: 'Three' as const,
      infoCards: [{ heading: 'Why apply', body: 'Open worldwide.' }]
    }
    const blocks = await parseMdxToBlocks(serialize({ ...original }), {
      locale: 'en'
    })
    expect(blocks).toEqual([{ __component: 'blocks.card-grid', ...original }])
  })

  it('round-trips Resource, Info, and Navigation', async () => {
    const resource = {
      ariaLabel: 'Resources',
      variant: 'Resource' as const,
      columns: 'Two' as const,
      resourceCards: [
        {
          heading: 'A',
          description: 'Desc A',
          secondaryCta: {
            link: '/a.pdf',
            text: 'Download',
            external: false,
            document: true
          }
        },
        {
          heading: 'B',
          description: 'Desc B',
          secondaryCta: {
            link: 'https://example.com',
            text: 'Open',
            external: true,
            document: false
          }
        }
      ]
    }
    expect(
      await parseMdxToBlocks(serialize({ ...resource }), { locale: 'en' })
    ).toEqual([{ __component: 'blocks.card-grid', ...resource }])

    const info = {
      ariaLabel: 'Program info',
      variant: 'Info' as const,
      columns: 'Three' as const,
      infoCards: [
        {
          heading: 'Why apply',
          body: '- Point 1\n- Point 2'
        }
      ]
    }
    expect(
      await parseMdxToBlocks(serialize({ ...info }), { locale: 'en' })
    ).toEqual([{ __component: 'blocks.card-grid', ...info }])

    const infoWithImage = {
      ariaLabel: 'Why participate',
      variant: 'Info' as const,
      columns: 'Three' as const,
      infoCards: [
        { heading: 'Build', body: 'Ship a prototype.' },
        {
          heading: 'Photo',
          image: { url: '/img/hackathon/participate.webp' },
          imageAlt: 'A builder coding'
        }
      ]
    }
    expect(
      await parseMdxToBlocks(serialize({ ...infoWithImage }), {
        locale: 'en',
        resolveMediaUpload: async (url) => {
          if (url === '/img/hackathon/participate.webp') return 42
          throw new Error(`unexpected upload ${url}`)
        }
      })
    ).toEqual([
      {
        __component: 'blocks.card-grid',
        ariaLabel: 'Why participate',
        variant: 'Info',
        columns: 'Three',
        infoCards: [
          { heading: 'Build', body: 'Ship a prototype.' },
          { heading: 'Photo', image: 42, imageAlt: 'A builder coding' }
        ]
      }
    ])

    const nav = {
      ariaLabel: 'Nav',
      variant: 'Navigation' as const,
      columns: 'One' as const,
      navigationCards: [
        {
          heading: 'Apply',
          secondaryCta: {
            link: '/apply',
            text: 'Start',
            external: false,
            document: false
          }
        }
      ]
    }
    expect(
      await parseMdxToBlocks(serialize({ ...nav }), { locale: 'en' })
    ).toEqual([{ __component: 'blocks.card-grid', ...nav }])
  })
})
