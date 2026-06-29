import { describe, expect, it } from 'vitest'
import { buildGridItems } from './grouping'
import { makeProject, makeTeam } from './test-fixtures'

describe('buildGridItems', () => {
  it('emits a team header followed by its projects, sorted by sortOrder', () => {
    const team = makeTeam({ id: 't1', name: 'Rafiki' })
    const projects = [
      makeProject({
        id: 'b',
        sortOrder: 2,
        team: { id: 't1', name: 'Rafiki', key: 'RAF', color: null }
      }),
      makeProject({
        id: 'a',
        sortOrder: 1,
        team: { id: 't1', name: 'Rafiki', key: 'RAF', color: null }
      })
    ]
    const items = buildGridItems(projects, [team])
    expect(
      items.map((i) =>
        i.type === 'team-header' ? `team:${i.team.name}` : i.project.id
      )
    ).toEqual(['team:Rafiki', 'a', 'b'])
  })

  it('pulls sub-team projects under their parent team', () => {
    const parent = makeTeam({
      id: 'parent',
      name: 'Parent',
      childrenIds: ['child']
    })
    const child = makeTeam({ id: 'child', name: 'Child' })
    const projects = [
      makeProject({
        id: 'cp',
        team: { id: 'child', name: 'Child', key: 'C', color: null }
      })
    ]
    const items = buildGridItems(projects, [parent, child])
    // Child is not a root team, so only the parent header appears.
    const headers = items.filter((i) => i.type === 'team-header')
    expect(headers).toHaveLength(1)
    expect(headers[0].type === 'team-header' && headers[0].team.name).toBe(
      'Parent'
    )
  })

  it('skips teams that have no projects', () => {
    const empty = makeTeam({ id: 'empty', name: 'Empty' })
    expect(buildGridItems([], [empty])).toEqual([])
  })

  it('appends projects with no team after the grouped ones', () => {
    const team = makeTeam({ id: 't1', name: 'Rafiki' })
    const projects = [
      makeProject({
        id: 'grouped',
        team: { id: 't1', name: 'Rafiki', key: 'R', color: null }
      }),
      makeProject({ id: 'orphan', team: null })
    ]
    const items = buildGridItems(projects, [team])
    const last = items[items.length - 1]
    expect(last.type === 'project' && last.project.id).toBe('orphan')
  })

  it('assigns running 1-based row numbers across headers and projects', () => {
    const team = makeTeam({ id: 't1', name: 'A' })
    const projects = [
      makeProject({
        id: 'a',
        sortOrder: 1,
        team: { id: 't1', name: 'A', key: 'A', color: null }
      }),
      makeProject({
        id: 'b',
        sortOrder: 2,
        team: { id: 't1', name: 'A', key: 'A', color: null }
      })
    ]
    const items = buildGridItems(projects, [team])
    expect(items.map((i) => i.row)).toEqual([1, 2, 3])
  })
})
