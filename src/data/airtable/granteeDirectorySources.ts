import projects from './grantee-data.json'
import profiles from './grantee-profiles.json'
import reports from './grant-reports.json'
import type { GranteeDirectorySources } from '@/utils/main/granteeDirectory'

// The inputs every grantee directory route and search index reads, in one
// place so they cannot disagree on which files they use.
export function granteeDirectorySources(): GranteeDirectorySources {
  return { projects, profiles, reports }
}
