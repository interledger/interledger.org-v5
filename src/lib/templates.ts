import type { CollectionKey } from 'astro:content'

/**
 * Cross-section template collections — profiles, FAQs, reports, etc.
 * Each entry can appear under any section (Foundation, Summit, Hackathon, Grant)
 * driven by its `section` frontmatter field. Adding a new cross-section template:
 * 1. Add its collection name here.
 * 2. Add a `case` in each section renderer's switch.
 * No changes needed to getStaticPaths or existing collections.
 */
export const crossSectionCollections = [
  'profiles',
  'faq'
] as const satisfies readonly CollectionKey[]

export type CrossSectionCollection = (typeof crossSectionCollections)[number]
