const getPreviewPathname = (
  uid: string,
  {
    documentId,
    document
  }: { documentId: string; document: Record<string, unknown> | null }
): string => {
  switch (uid) {
    case 'api::foundation-blog-post.foundation-blog-post':
      return document?.documentId
        ? `/blog/preview?slug=${document.documentId}&type=foundation`
        : '/blog'
    case 'api::foundation-page.foundation-page':
      // documentId comes directly from the handler — no findOne needed
      return `/page-preview?documentId=${documentId}`
    case 'api::summit-page.summit-page': {
      const path =
        (document?.path as string)?.replace(/^\//, '') ||
        (document?.slug as string)
      return path ? `/summit/${path}?preview=true` : null
    }
    default:
      return null
  }
}

export default ({ env }) => {
  const clientUrl = env('CLIENT_URL')

  return {
    auth: {
      secret: env('ADMIN_JWT_SECRET')
    },
    apiToken: {
      salt: env('API_TOKEN_SALT')
    },
    transfer: {
      token: {
        salt: env('TRANSFER_TOKEN_SALT')
      }
    },
    flags: {
      nps: env.bool('FLAG_NPS', true),
      promoteEE: env.bool('FLAG_PROMOTE_EE', true)
    },
    preview: {
      enabled: true,
      config: {
        allowedOrigins: clientUrl,
        async handler(uid, { documentId }) {
          // Fetch the complete document from Strapi
          const document = await strapi.documents(uid).findOne({ documentId })

          // Generate the preview pathname based on content type and document
          const pathname = getPreviewPathname(uid, { documentId, document })

          // Disable preview if the pathname is not found
          if (!pathname) {
            return null
          }

          return `${clientUrl}${pathname}`
        }
      }
    }
  }
}
