import path from 'path'
import { getCmsDir, PATHS } from '../src/utils/paths'

export default () => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.resolve(getCmsDir(), PATHS.DB_FILE)
    },
    useNullAsDefault: true
  }
})
