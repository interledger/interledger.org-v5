import type { Project, Team } from '@/types/roadmap'

// Purely structural: a flat, ordered list of team-header and project rows. It
// carries no per-team/per-project color from Linear — RoadmapBoard applies
// accessible alternating row colors instead, per Sarah's INTORG-636 / INTORG-737
// feedback (Linear colors were flagged for insufficient contrast).
export type GridItem =
  | { type: 'team-header'; team: Team; row: number }
  | { type: 'project'; project: Project; row: number }

export function buildGridItems(projects: Project[], teams: Team[]): GridItem[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const allChildIds = new Set(teams.flatMap((t) => t.childrenIds))
  const rootTeams = teams.filter((t) => !allChildIds.has(t.id))

  const projectsByTeamId = new Map<string, Project[]>()
  for (const proj of projects) {
    if (!proj.team) continue
    const tid = proj.team.id
    if (!projectsByTeamId.has(tid)) projectsByTeamId.set(tid, [])
    projectsByTeamId.get(tid)!.push(proj)
  }

  function collectTeamProjects(teamId: string): Project[] {
    const team = teamMap.get(teamId)
    if (!team) return []
    const own = projectsByTeamId.get(teamId) ?? []
    const fromChildren = team.childrenIds.flatMap(
      (cid) => projectsByTeamId.get(cid) ?? []
    )
    return [...own, ...fromChildren].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const gridItems: GridItem[] = []
  let currentRow = 1

  for (const rootTeam of rootTeams) {
    const teamProjects = collectTeamProjects(rootTeam.id)
    if (teamProjects.length === 0) continue
    gridItems.push({ type: 'team-header', team: rootTeam, row: currentRow })
    currentRow++
    for (const proj of teamProjects) {
      gridItems.push({ type: 'project', project: proj, row: currentRow })
      currentRow++
    }
  }

  const assignedIds = new Set(
    gridItems.flatMap((i) => (i.type === 'project' ? [i.project.id] : []))
  )
  const uncategorised = projects
    .filter((p) => !assignedIds.has(p.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  for (const proj of uncategorised) {
    gridItems.push({ type: 'project', project: proj, row: currentRow })
    currentRow++
  }

  return gridItems
}
