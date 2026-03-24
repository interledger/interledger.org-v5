import type { MiddlewareHandler } from 'astro'
import { routeContextFromPathname } from '@/utils/routeContext'

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { routeLocale, currentSlug, currentBasePath } =
    routeContextFromPathname(context.url.pathname)
  context.locals.routeLocale = routeLocale
  context.locals.currentSlug = currentSlug
  context.locals.currentBasePath = currentBasePath
  return next()
}
