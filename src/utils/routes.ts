export const ROUTE_BASES = {
  'foundation-pages': '',
  'foundation-blog': '/blog',
  'developers-blog': '/developers/blog',
  'summit-pages': '/summit'
} as const

export type RouteCollection = keyof typeof ROUTE_BASES
