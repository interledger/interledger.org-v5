import { LinearClient } from '@linear/sdk'
import { LINEAR_API_KEY } from './env'

export const linear = new LinearClient({
  apiKey: LINEAR_API_KEY || undefined
})
