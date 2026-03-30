/**
 * Shared Strapi v5 Document API types.
 * Avoids duplicating the interface across lifecycle files.
 */

export interface StrapiDocumentAPI {
  findOne: (options: {
    documentId: string
    locale: string
    status: string
    populate: Record<string, unknown>
  }) => Promise<unknown>
  findFirst: (options: {
    status: string
    populate: Record<string, unknown>
  }) => Promise<unknown>
}

export interface StrapiGlobal {
  documents: (uid: string) => StrapiDocumentAPI
  requestContext: {
    get: () => { request?: { headers?: Record<string, string> } } | null
  }
}
