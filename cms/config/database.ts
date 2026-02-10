import path from 'path'

export default () => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.resolve(process.cwd(), '.tmp/data.db')
    },
    useNullAsDefault: true
  }
})
