import { z } from 'zod'
import type { SyncedImage } from '@/types/airtable'

// Shapes shared by the readers of the Airtable JSON files.

export const syncedImageSchema = z.object({
  path: z.string().startsWith('/'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string()
}) satisfies z.ZodType<SyncedImage>
