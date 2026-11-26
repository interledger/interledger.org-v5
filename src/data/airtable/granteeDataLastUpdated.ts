import lastUpdated from './last-updated.json'
import { parseGranteeDataLastUpdated } from '@/utils/main/granteeDataUpdated'

// The day the grantee data last changed, for the directory's "Last updated" line.
export function granteeDataLastUpdated(): string | Error {
  return parseGranteeDataLastUpdated(lastUpdated)
}
