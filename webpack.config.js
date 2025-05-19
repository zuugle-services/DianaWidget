// webpack.config.js
const path = require('path');
const webpack = require('webpack');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'DianaWidget.bundle.js', // This ensures the main output file is named DianaWidget.bundle.js
    library: {
      name: 'DianaWidget',
      type: 'umd',
      export: 'default'
    },
    assetModuleFilename: 'assets/[hash][ext][query]' // Defines a general path for other assets if not inlined
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader', // Injects styles into the DOM
          {
            loader: 'css-loader', // Translates CSS into CommonJS
            options: {
              modules: {
                localIdentName: 'diana-[local]__[hash:base64:5]' // Configures CSS Modules
              }
            }
          },
          'postcss-loader' // Processes CSS with PostCSS
        ]
      },
      {
        test: /\.(ttf|woff|woff2|eot|otf)$/i, // Rule for font files
        type: 'asset/inline' // Inlines fonts as base64 data URIs
      }
    ]
  },
  optimization: {
    splitChunks: false, // Disables automatic code splitting for vendor/common chunks
    // We are using LimitChunkCountPlugin instead of more granular chunk control here
    // to try and force a single file.
  },
  plugins: [
    new WebpackManifestPlugin(), // Generates a manifest.json file
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1, // Tells Webpack to output at most 1 chunk (your main bundle)
    }),
  ]
};