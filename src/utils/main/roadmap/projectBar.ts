import type { Project, Milestone } from '@/types/roadmap'
import type { TimelinePositioner } from './timeline'

export interface ProjectBarProps {
  hasDates: boolean
  barLeft: string | null
  barWidth: string | null
  hasCompletedBar: boolean
  completedBarLeft: string | null
  completedBarWidth: string | null
  hasExtension: boolean
  extensionLeft: string | null
  extensionWidth: string | null
  datedMilestones: Milestone[]
}

// Keep a sliver visible for in-window bars whose span rounds to ~0%.
const MIN_VISIBLE_WIDTH = 0.5

// A bar runs from `start` to `end`, but both endpoints are clamped to the
// visible window (pctLeft is 0–100), and the width is the gap between them. This
// guarantees `left + width <= 100`, so a project that starts before or ends after
// the window can't render a bar wider than the track. An unclamped width here
// would overflow the track, inflate the scroll container's scrollWidth, and break
// the sticky label column (the column releases once you scroll past the table).
function clampedBar(
  pos: TimelinePositioner,
  start: Date,
  end: Date
): { left: string; width: string } {
  const left = pos.pctLeft(start)
  const right = pos.pctLeft(end)
  const width = Math.min(Math.max(right - left, MIN_VISIBLE_WIDTH), 100 - left)
  return { left: left.toFixed(2), width: Math.max(width, 0).toFixed(2) }
}

export function computeProjectBarProps(
  proj: Project,
  pos: TimelinePositioner
): ProjectBarProps {
  const hasDates = !!(proj.startDate && proj.targetDate)
  const bar = hasDates
    ? clampedBar(pos, new Date(proj.startDate!), new Date(proj.targetDate!))
    : null

  const datedMilestones = proj.milestones.filter((ms) => ms.targetDate)

  const hasCompletedBar = !!(
    proj.startDate &&
    !proj.targetDate &&
    proj.completedAt
  )
  const completedBar = hasCompletedBar
    ? clampedBar(pos, new Date(proj.startDate!), new Date(proj.completedAt!))
    : null

  const lastMilestoneDate =
    datedMilestones.length > 0
      ? new Date(
          Math.max(
            ...datedMilestones.map((ms) => new Date(ms.targetDate!).getTime())
          )
        )
      : null

  const hasExtension =
    hasDates &&
    lastMilestoneDate !== null &&
    lastMilestoneDate > new Date(proj.targetDate!)
  const extension =
    hasExtension && lastMilestoneDate
      ? clampedBar(pos, new Date(proj.targetDate!), lastMilestoneDate)
      : null

  return {
    hasDates,
    barLeft: bar?.left ?? null,
    barWidth: bar?.width ?? null,
    hasCompletedBar,
    completedBarLeft: completedBar?.left ?? null,
    completedBarWidth: completedBar?.width ?? null,
    hasExtension,
    extensionLeft: extension?.left ?? null,
    extensionWidth: extension?.width ?? null,
    datedMilestones
  }
}
