import projects from './grantee-data.json'
import profiles from './grantee-profiles.json'
import reports from './grant-reports.json'
import { hideGrantReports } from '@/utils/main/publishGate'
import type { GranteeDirectorySources } from '@/utils/main/granteeDirectory'

// The inputs every grantee directory route and search index reads, in one
// place so they cannot disagree on which files or which gate they use.
export function granteeDirectorySources(): GranteeDirectorySources {
  return { projects, profiles, reports, showReports: !hideGrantReports() }
}
