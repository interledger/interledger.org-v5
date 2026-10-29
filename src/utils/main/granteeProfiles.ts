import { z } from 'zod'
import type { GranteeProfile } from '@/types/airtable'
import type { Grantee } from './grantee'

// Reads src/data/airtable/grantee-profiles.json for the profile pages. The
// Airtable sync already validates every record before it writes the file, so
// a failure here means the file was edited by hand or the sync and the site
// disagree on the shape. The build fails then, instead of rendering a page
// with holes in it.

const syncedImageSchema = z.object({
  path: z.string().startsWith('/'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string()
})

const nullableText = z.string().min(1).nullable()

const granteeProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  granteeType: z.enum(['Organisation', 'Individual']),
  formerlyKnownAs: nullableText,
  description: nullableText,
  country: nullableText,
  website: z.url().nullable(),
  twitter: z.url().nullable(),
  linkedIn: z.url().nullable(),
  bluesky: z.url().nullable(),
  grantIds: z.array(z.string().min(1)),
  grantCount: z.number().nonnegative(),
  totalCommitted: z.number().nonnegative(),
  publishedReportCount: z.number().nonnegative(),
  thematicTags: z.array(z.string().min(1)),
  logo: syncedImageSchema.nullable()
}) satisfies z.ZodType<GranteeProfile>

const granteeProfilesSchema = z.array(granteeProfileSchema)

export function parseGranteeProfiles(data: unknown): GranteeProfile[] | Error {
  const result = granteeProfilesSchema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    return new Error(
      `grantee-profiles.json does not match the profile shape at ${issue?.path.join('.') ?? '(root)'}: ${issue?.message ?? 'unknown error'}`
    )
  }
  return result.data
}

export interface GranteeProfilePath {
  params: { slug: string }
  props: { profile: GranteeProfile }
}

// One static path per profile, or none while the feature gate is on. The
// caller passes the gate in, so this stays a pure function of its input.
export function getGranteeProfilePaths(
  data: unknown,
  hideProfiles: boolean
): GranteeProfilePath[] | Error {
  if (hideProfiles) return []
  const profiles = parseGranteeProfiles(data)
  if (profiles instanceof Error) return profiles
  return profiles.map((profile) => ({
    params: { slug: profile.slug },
    props: { profile }
  }))
}

// The profile's grants as the grantee directory shows them, newest first. A
// grant that is not in the directory (its project is not published on the
// website) is left out: the profile must not show more than the directory.
export function getProfileGrants(
  profile: GranteeProfile,
  directoryGrantees: Grantee[]
): Grantee[] {
  const grantIds = new Set(profile.grantIds)
  return directoryGrantees
    .filter((grantee) => grantIds.has(grantee.id))
    .sort(
      (a, b) =>
        b.year.localeCompare(a.year) || b.startMonth.localeCompare(a.startMonth)
    )
}
