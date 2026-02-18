import CopyPlugin from 'copy-webpack-plugin'

export default (config) => {
  // Copy JSON files after build

  config.plugins.push(
    new CopyPlugin({
      patterns: [
        {
          from: 'src/**/*.json',
          to: '../dist/src/[path][name][ext]',
          context: '.'
        }
      ]
    })
  )

  return config
}
