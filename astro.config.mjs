import { defineConfig } from 'astro/config'
// TODO uncomment Netlify
// import netlify from '@astrojs/netlify'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
  site: 'https://interledger.org',
  // TODO Translation work goes here
  // i18n: {
  //   locales: ['es', 'en'],
  //   defaultLocale: 'en',
  //   routing: {
  //     prefixDefaultLocale: false,
  //     fallbackType: 'rewrite'
  //   },
  //   fallback: {
  //     es: 'en'
  //   }
  // },
  output: 'static',
  prerender: {
    default: true
  },
  // adapter: netlify(),
  integrations: [
    mdx()
  ],
  vite: {
    plugins: [tailwindcss()]
  },
  redirects: {
    '/hacktoberfest': 'https://interledger.org/hacktoberfest',
    '/hacktoberfest-2023': 'https://interledger.org/hacktoberfest'
  },
  server: {
    port: 1103
  }
})
