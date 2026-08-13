/**
 * Scrollspy: highlights whichever section is currently in the "reading band"
 * near the top of the viewport, by toggling `data-active`/`aria-current` on
 * the matching nav link. Shared by FaqSectionsNav and ReportSectionsNav.
 *
 * Modeled on the intersecting-Set pattern in
 * src/components/layout/foundation-header.ts. Each container is scoped via
 * `containerSelector` so multiple nav instances on the same page (or across
 * Carousel-style repeated blocks) don't collide.
 */
interface SectionNavScrollspyOptions {
  containerSelector: string
  linkSelector: string
}

export function initSectionNavScrollspy({
  containerSelector,
  linkSelector
}: SectionNavScrollspyOptions) {
  document.querySelectorAll<HTMLElement>(containerSelector).forEach((nav) => {
    const links = Array.from(
      nav.querySelectorAll<HTMLAnchorElement>(linkSelector)
    )
    const sections = links
      .map((link) => document.getElementById(link.dataset.target ?? ''))
      .filter((el): el is HTMLElement => el !== null)

    if (sections.length === 0) return

    const intersecting = new Set<Element>()
    let activeId = links[0]?.dataset.target

    const setActive = () => {
      activeId =
        sections.find((section) => intersecting.has(section))?.id ?? activeId

      for (const link of links) {
        const isActive = link.dataset.target === activeId
        link.dataset.active = String(isActive)
        if (isActive) {
          link.setAttribute('aria-current', 'true')
        } else {
          link.removeAttribute('aria-current')
        }
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            intersecting.add(entry.target)
          } else {
            intersecting.delete(entry.target)
          }
        }
        setActive()
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    )

    sections.forEach((section) => observer.observe(section))
  })
}
