// webpack.config.js
const path = require('path');
const webpack = require('webpack');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const sass = require('sass');

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
        test: /\.(s[ac]|c)ss$/i, // Updated to include .scss, .sass, and .css
        use: [
          'to-string-loader', // Exports the CSS as a string, which is needed for Shadow DOM.
          'css-loader',     // Translates CSS into CommonJS.
          'postcss-loader', // Processes CSS with PostCSS.
          {
            loader: 'sass-loader',
            options: {
              implementation: sass, // Explicitly use the dart-sass implementation.
              api: 'modern',        // Force the modern JS API to avoid deprecation warnings.
            },
          }
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