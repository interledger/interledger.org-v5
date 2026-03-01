/**
 * Shared utilities for Strapi lifecycle hooks.
 * Strapi types, skip-check, and git commit helper.
 */

import { gitCommitAndPush } from './gitSync'

declare const strapi: {
  documents: (uid: string) => {
    findOne?: (options: {
      documentId: string
      locale: string
      status: string
      populate: Record<string, unknown>
    }) => Promise<unknown>
    findFirst?: (options: {
      status: string
      populate: Record<string, unknown>
    }) => Promise<unknown>
  }
  requestContext: {
    get: () => { request?: { headers?: Record<string, string> } } | null
  }
}

export { strapi }

export function shouldSkipMdxExport(): boolean {
  try {
    const ctx = strapi.requestContext.get() as {
      request?: { headers?: Record<string, string> }
    } | null
    return ctx?.request?.headers?.['x-skip-mdx-export'] === 'true'
  } catch {
    return false
  }
}

export async function commitPaths(
  paths: string[],
  message: string
): Promise<void> {
  if (paths.length > 0) await gitCommitAndPush(paths, message)
}
