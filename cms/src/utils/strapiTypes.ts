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
    locale?: string
    populate: Record<string, unknown>
  }) => Promise<unknown>
}

export interface StrapiAdminUser {
  firstname?: string
  lastname?: string
  email?: string
}

export interface StrapiGlobal {
  documents: (uid: string) => StrapiDocumentAPI
  requestContext: {
    get: () => {
      request?: { headers?: Record<string, string> }
      state?: { user?: StrapiAdminUser }
    } | null
  }
  log: { warn: (msg: string) => void }
}
