import { ui, defaultLang } from './ui.ts'
import type { LanguageKey } from './ui.ts'
import { getRelativeLocaleUrl, pathHasLocale } from 'astro:i18n';
// Astro’s built-in file-based routing automatically creates URL routes for you based on your file structure within src/pages/.

export function useTranslations(targetLanguage: LanguageKey) {
    return function t(key: keyof (typeof ui)[typeof defaultLang]) {
        const defaultStrings = ui[defaultLang]
        const targetStrings = ui[targetLanguage] as Partial<typeof defaultStrings>

        return targetStrings[key] ?? defaultStrings[key]
    }
}

export function translatePath(path: string, targetLang: LanguageKey) {
    // exceptions:
    // when paginating through blogs you have /developers/blog/2 the language switcher should strip the numeric value
    // TODO build out content ID functionality so we can support spanish URLs and not just file mapping
    // I think this only works if you get the current locale out
    if (pathHasLocale(path)) {
        // TODO strip it out
    }
    return getRelativeLocaleUrl(targetLang, path)
}
