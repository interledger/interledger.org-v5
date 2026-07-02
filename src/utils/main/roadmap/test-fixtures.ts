import type { Project, Team } from '@/types/roadmap'

// Test-only factories. Not exported through the utils barrel.

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Project',
    description: null,
    color: null,
    state: 'started',
    icon: null,
    priority: 0,
    progress: 0,
    sortOrder: 0,
    startDate: null,
    targetDate: null,
    completedAt: null,
    url: null,
    team: null,
    milestones: [],
    ...overrides
  }
}

export function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 't1',
    name: 'Team',
    key: 'TEAM',
    color: null,
    childrenIds: [],
    projectCount: 0,
    ...overrides
  }
}
