import type { Project } from '@/types/roadmap'

export function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1))
}

export function monthEnd(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))
}

function projectDates(proj: Project): Date[] {
  const dates: Date[] = []
  if (proj.startDate) dates.push(new Date(proj.startDate))
  if (proj.targetDate) dates.push(new Date(proj.targetDate))
  if (proj.completedAt) dates.push(new Date(proj.completedAt))
  for (const ms of proj.milestones) {
    if (ms.targetDate) dates.push(new Date(ms.targetDate))
  }
  return dates
}

export function computeDateRange(projects: Project[]): {
  minDate: Date
  maxDate: Date
} {
  const allDates = projects.flatMap(projectDates)

  const fallbackStart = new Date()
  const fallbackEnd = new Date(fallbackStart)
  fallbackEnd.setUTCFullYear(fallbackEnd.getUTCFullYear() + 1)

  return {
    minDate: allDates.length
      ? new Date(Math.min(...allDates.map((d) => d.getTime())))
      : fallbackStart,
    maxDate: allDates.length
      ? new Date(Math.max(...allDates.map((d) => d.getTime())))
      : fallbackEnd
  }
}

// The roadmap timeline is capped to a near-term window so old/long-running
// projects don't stretch the axis back years and leave most rows looking empty
// (Sarah's INTORG-636 note: "if we start in 2024, most projects look like they
// have nothing going on"). The window is the current calendar year plus the next
// one — i.e. 2026–2027 today — derived from `now` so it never goes stale.
export function roadmapWindow(now: Date): { start: Date; end: Date } {
  const year = now.getUTCFullYear()
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 11, 31, 23, 59, 59, 999))
  }
}

// A project belongs in the windowed view if its date span overlaps the window.
// Undated projects are kept (they render as a labelled row with no bar and don't
// affect the column range); projects whose activity is entirely outside the
// window are dropped.
export function projectOverlapsWindow(
  proj: Project,
  start: Date,
  end: Date
): boolean {
  const dates = projectDates(proj)
  if (dates.length === 0) return true
  const times = dates.map((d) => d.getTime())
  const min = Math.min(...times)
  const max = Math.max(...times)
  return max >= start.getTime() && min <= end.getTime()
}

// Clamp a data-derived range into the window bounds so the axis never extends
// past it, while still shrinking to the data when the data is narrower.
export function clampRangeToWindow(
  minDate: Date,
  maxDate: Date,
  start: Date,
  end: Date
): { minDate: Date; maxDate: Date } {
  return {
    minDate: minDate < start ? start : minDate,
    maxDate: maxDate > end ? end : maxDate
  }
}
