import { describe, expect, it } from 'vitest'
import { computeProjectBarProps } from './projectBar'
import { createPositioner } from './timeline'
import { makeProject } from './test-fixtures'

const pos = createPositioner(Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1))

describe('computeProjectBarProps', () => {
  it('reports a duration bar when both start and target dates are set', () => {
    const props = computeProjectBarProps(
      makeProject({ startDate: '2026-01-01', targetDate: '2026-07-01' }),
      pos
    )
    expect(props.hasDates).toBe(true)
    expect(props.barLeft).toBe('0.00')
    expect(Number(props.barWidth)).toBeGreaterThan(0)
  })

  it('clamps a bar that spans beyond the window so left + width never exceeds 100%', () => {
    // Spans well before and after the 2026 window. An unclamped width here would
    // overflow the track and create phantom horizontal scroll (breaks the sticky
    // label column). Both endpoints clamp to [0,100], so the bar fills the window.
    const props = computeProjectBarProps(
      makeProject({ startDate: '2024-01-01', targetDate: '2028-06-01' }),
      pos
    )
    expect(props.barLeft).toBe('0.00')
    expect(Number(props.barLeft) + Number(props.barWidth)).toBeLessThanOrEqual(
      100
    )
    expect(props.barWidth).toBe('100.00')
  })

  it('keeps a bar starting before the window within bounds', () => {
    const props = computeProjectBarProps(
      makeProject({ startDate: '2023-06-01', targetDate: '2026-07-01' }),
      pos
    )
    expect(props.barLeft).toBe('0.00')
    expect(Number(props.barLeft) + Number(props.barWidth)).toBeLessThanOrEqual(
      100
    )
  })

  it('has no duration bar when dates are missing', () => {
    const props = computeProjectBarProps(makeProject(), pos)
    expect(props.hasDates).toBe(false)
    expect(props.barLeft).toBeNull()
    expect(props.barWidth).toBeNull()
  })

  it('renders a completed bar when there is a start + completedAt but no target', () => {
    const props = computeProjectBarProps(
      makeProject({
        startDate: '2026-02-01',
        targetDate: null,
        completedAt: '2026-05-01'
      }),
      pos
    )
    expect(props.hasCompletedBar).toBe(true)
    expect(props.completedBarLeft).not.toBeNull()
  })

  it('adds an extension when a milestone lands beyond the target date', () => {
    const props = computeProjectBarProps(
      makeProject({
        startDate: '2026-01-01',
        targetDate: '2026-06-01',
        milestones: [{ id: 'm1', name: 'late', targetDate: '2026-10-01' }]
      }),
      pos
    )
    expect(props.hasExtension).toBe(true)
    expect(props.extensionWidth).not.toBeNull()
  })

  it('keeps only milestones that have a target date', () => {
    const props = computeProjectBarProps(
      makeProject({
        startDate: '2026-01-01',
        targetDate: '2026-06-01',
        milestones: [
          { id: 'm1', name: 'dated', targetDate: '2026-03-01' },
          { id: 'm2', name: 'undated', targetDate: null }
        ]
      }),
      pos
    )
    expect(props.datedMilestones.map((m) => m.id)).toEqual(['m1'])
  })
})
