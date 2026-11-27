import { getDatabaseFilePath } from '../src/utils/paths'

export default () => ({
  connection: {
    client: 'sqlite',
    connection: {
      // DATABASE_FILENAME, resolved against cwd. Default: .tmp/data.db.
      filename: getDatabaseFilePath()
    },
    useNullAsDefault: true
  }
})
