import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'
import { redirects } from './redirects.ts'
import starlight from '@astrojs/starlight'
import starlightFullViewMode from 'starlight-fullview-mode'
import netlify from '@astrojs/netlify'
import mdx from '@astrojs/mdx'
import { PUBLISHED_RFC_SIDEBAR_ITEMS } from './src/data/docs/rfcs.ts'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import rehypeUmamiLinks from './src/utils/main/rehypeUmamiLinks.ts'
import rehypeWrapScrollableTables from './src/utils/main/rehypeWrapScrollableTables.ts'
import { stripDocsCssFromMainSite } from './src/integrations/strip-docs-css-from-main-site.ts'

// https://astro.build/config
export default defineConfig({
  site: 'https://interledger.org',
  build: {
    // Inline project CSS so Lighthouse does not wait on extra /_astro/*.css round trips.
    inlineStylesheets: 'always'
  },
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
      fallbackType: 'rewrite'
    }
  },
  output: 'static',
  prerender: {
    default: true
  },
  adapter: netlify({
    // public/img and public/uploads are CMS-driven and can grow into the
    // hundreds of MB. getOptimizedImage() (src/utils/main/images.ts) does a
    // runtime fs.existsSync check against public/, which makes the function
    // bundler's dependency tracer pull the whole directory into the SSR
    // function — pushing it past AWS Lambda's size limit. These assets are
    // served by the CDN / read at build time only, never needed at Lambda
    // runtime, so they're excluded from the function bundle here.
    excludeFiles: ['./public/img/**/*', './public/uploads/**/*']
  }),
  markdown: {
    rehypePlugins: [rehypeUmamiLinks, rehypeWrapScrollableTables]
  },
  integrations: [
    stripDocsCssFromMainSite(),
    starlight({
      title: 'Interledger',
      description: 'Enable seamless exchange of value across payment networks.',
      customCss: [
        './node_modules/@interledger/docs-design-system/src/styles/teal-theme.css',
        './node_modules/@interledger/docs-design-system/src/styles/ilf-docs.css',
        './src/styles/interledger.css',
        './src/styles/atom-one-light.min.css'
      ],
      plugins: [
        starlightFullViewMode({
          leftSidebarEnabled: true,
          rightSidebarEnabled: true
        })
      ],
      head: [
        {
          tag: 'script',
          attrs: {
            src: '/developers/scripts/highlight.min.js',
            defer: true
          }
        },
        {
          tag: 'script',
          attrs: {
            src: '/developers/scripts/init.js',
            defer: true
          }
        },
        {
          tag: 'script',
          attrs: {
            defer: true,
            'data-website-id': '50d81dd1-bd02-4f82-8a55-34a09ccbbbd9',
            src: 'https://uwa.interledger.org/script.js',
            'data-domains': 'interledger.org'
          }
        }
      ],
      components: {
        Header: './src/components/docs/Header.astro',
        PageSidebar: './src/components/docs/PageSidebar.astro'
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/interledger'
        }
      ],
      sidebar: [
        {
          label: 'Overview',
          link: '/developers/get-started'
        },
        {
          label: 'Get involved',
          link: '/developers/get-involved'
        },
        {
          label: 'Specifications',
          items: [
            ...PUBLISHED_RFC_SIDEBAR_ITEMS,
            {
              label: 'Payment Pointers',
              link: 'https://paymentpointers.org',
              attrs: {
                target: '_blank',
                rel: 'noopener noreferrer',
                'data-icon': 'external'
              }
            }
          ]
        }
      ],
      expressiveCode: {
        themes: ['github-dark-dimmed'],
        styleOverrides: {
          borderColor: 'transparent',
          borderRadius: 'var(--radius)'
        },
        defaultProps: {
          wrap: true
        }
      },
      disable404Route: true
    }),
    mdx(),
    sitemap({
      filter: (url) => !new URL(url).pathname.includes('/preview')
    })
  ],
  vite: {
    server: {
      allowedHosts: ['.netlify.app', '.interledger.org']
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    plugins: [tailwindcss()]
  },
  redirects,
  server: {
    port: 1103
  }
})
