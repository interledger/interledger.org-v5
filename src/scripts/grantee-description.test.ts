import { describe, expect, it } from 'vitest'
import { umamiLabelForReadMoreClick } from './grantee-description'

describe('umamiLabelForReadMoreClick', () => {
  it('logs "read more" when the click expands the description', () => {
    expect(umamiLabelForReadMoreClick(true, 'read more', 'read less')).toBe(
      'read more'
    )
  })

  it('logs "read less" when the click collapses the description', () => {
    expect(umamiLabelForReadMoreClick(false, 'read more', 'read less')).toBe(
      'read less'
    )
  })
})
