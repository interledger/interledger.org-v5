import type { MDXFile } from './mdxTypes'

// Allow undefined values to test edge cases without casts
type MdxFileOverrides = Partial<{
  [K in keyof MDXFile]: MDXFile[K] | undefined
}>

export function createMdxFile(overrides: MdxFileOverrides = {}): MDXFile {
  return {
    file: 'test.mdx',
    filepath: '/content/test.mdx',
    slug: 'test',
    locale: 'en',
    frontmatter: {},
    content: '',
    isLocalization: false,
    localizes: null,
    ...overrides
  } as MDXFile
}
