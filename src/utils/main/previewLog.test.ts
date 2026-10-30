import { afterEach, describe, expect, it, vi } from 'vitest'
import { logPreviewFetchError } from './previewLog'

describe('logPreviewFetchError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs the route, the document and the error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cause = new Error('Strapi fetch failed: 401 Unauthorized')

    logPreviewFetchError('profile-preview', 'profile abc123', cause)

    expect(error).toHaveBeenCalledWith(
      '[profile-preview] Could not load profile abc123 from Strapi:',
      cause
    )
  })
})
