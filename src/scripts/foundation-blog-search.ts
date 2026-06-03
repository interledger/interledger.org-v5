import type { SearchIndexEntry } from '@/types/foundationBlogSearch'
import { searchFoundationBlog } from '@/utils/main/foundationBlogSearch'

let cachedIndex: SearchIndexEntry[] | null = null

async function fetchIndex(indexUrl: string): Promise<SearchIndexEntry[] | Error> {
  if (cachedIndex) return cachedIndex
  const res = await fetch(indexUrl)
  if (!res.ok) return new Error(`HTTP ${res.status}`)
  cachedIndex = (await res.json()) as SearchIndexEntry[]
  return cachedIndex
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toDateString().substring(4)
}

function buildResultCard(
  entry: SearchIndexEntry,
  blogBase: string,
  readMoreLabel: string
): string {
  const href = `${blogBase}/${entry.pathSlug}`
  const thumb = entry.thumbnailImage
    ? `<div class="shrink-0">
        <img
          loading="lazy"
          src="${entry.thumbnailImage}"
          width="250"
          height="250"
          alt="${entry.thumbnailImageAlt ?? ''}"
          class="w-62.5 h-62.5 object-cover"
        />
      </div>`
    : ''

  return `<li class="flex flex-col gap-space-s pb-space-m mb-space-m rounded shadow-[0_10px_6px_-10px_rgba(0,0,0,0.25)] md:flex-row">
    ${thumb}
    <div class="flex flex-col flex-1">
      <h2 class="text-step-1 mb-space-3xs">
        <a href="${href}" class="text-black font-bold underline decoration-transparent transition-all duration-300 hover:underline hover:decoration-inherit">
          ${entry.title}
        </a>
      </h2>
      <time class="block text-step--1 mb-space-2xs" datetime="${entry.date}">
        ${formatDate(entry.date)}
      </time>
      <p class="leading-snug mb-space-2xs grow">${entry.description}</p>
      <a
        href="${href}"
        class="group self-start flex gap-space-2xs text-step--1 underline decoration-transparent transition-all duration-300 hover:underline hover:text-inherit hover:decoration-inherit"
      >
        ${readMoreLabel}
        <svg viewBox="0 0 12 12" class="w-[0.75em] group-hover:translate-x-[0.25em] transition-all duration-300">
          <path d="M11.92 5.62a1.001 1.001 0 0 0-.21-.33l-5-5a1.004 1.004 0 0 0-1.42 1.42L8.59 5H1a1 1 0 0 0 0 2h7.59l-3.3 3.29a1.002 1.002 0 0 0 .325 1.639 1 1 0 0 0 1.095-.219l5-5a1 1 0 0 0 .21-.33 1 1 0 0 0 0-.76Z" fill="currentColor" />
        </svg>
      </a>
    </div>
  </li>`
}

function renderResults(
  container: HTMLElement,
  results: SearchIndexEntry[],
  query: string,
  strings: { noResults: string; resultCount: string; error: string; readMore: string },
  blogBase: string
): void {
  if (results.length === 0) {
    container.innerHTML = `<p class="text-step--1 text-neutral-75">${strings.noResults.replace('{query}', query)}</p>`
    return
  }

  const countLabel = strings.resultCount.replace('{count}', String(results.length))
  const cards = results.map((r) => buildResultCard(r, blogBase, strings.readMore)).join('')

  container.innerHTML = `
    <p class="text-step--1 mb-space-s">${countLabel}</p>
    <ol class="list-none p-0">${cards}</ol>
  `
}

export function initFoundationBlogSearch(
  indexUrl: string,
  blogBase: string
): void {
  const outputEl = document.getElementById('search-output')
  const searchInput = document.getElementById(
    'foundation-blog-search'
  ) as HTMLInputElement | null

  if (!outputEl || !searchInput) return

  const strings = {
    noResults: outputEl.dataset.noResults ?? 'No results found for "{query}"',
    resultCount: outputEl.dataset.resultCount ?? '{count} results',
    error: outputEl.dataset.error ?? 'Search unavailable, please try again.',
    readMore: outputEl.dataset.readMore ?? 'Read more',
  }

  const query = new URLSearchParams(window.location.search).get('q') ?? ''
  searchInput.value = query

  async function runSearch(q: string): Promise<void> {
    if (!q.trim()) {
      outputEl!.innerHTML = ''
      return
    }

    const index = await fetchIndex(indexUrl)
    if (index instanceof Error) {
      outputEl!.innerHTML = `<p class="text-step--1 text-red-600">${strings.error}</p>`
      return
    }

    renderResults(outputEl!, searchFoundationBlog(index, q), q, strings, blogBase)
  }

  void runSearch(query)

  let debounceTimer: ReturnType<typeof setTimeout>
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const newQuery = searchInput.value
      const url = new URL(window.location.href)
      if (newQuery.trim()) {
        url.searchParams.set('q', newQuery)
      } else {
        url.searchParams.delete('q')
      }
      window.history.replaceState({}, '', url)
      void runSearch(newQuery)
    }, 200)
  })
}
