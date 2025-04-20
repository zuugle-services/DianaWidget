// webpack.config.js
const path = require('path');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'DianaWidget.bundle.js',
    library: {
      name: 'DianaWidget',
      type: 'umd',
      export: 'default'
    }
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: 'diana-[local]__[hash:base64:5]'
              }
            }
          },
          'postcss-loader'
        ]
      }
    ]
  },
  plugins: [
    new WebpackManifestPlugin()
  ]
};