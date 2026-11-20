// webpack.config.js
const path = require('path');
const webpack = require('webpack');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const sass = require('sass');
const { version } = require('./package.json');

// Commit being built (the checked-out one, also in a deploy of an older ref); empty outside a git checkout.
let commit = '';
try {
  commit = require('child_process').execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // not a git checkout
}

module.exports = {
  entry: './src/index.ts',
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
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
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
    // Version from package.json (release-please bumps it): `DianaWidget.version` at runtime and a banner
    // comment as the first line of the bundle, so a deployed file says which release it is.
    new webpack.DefinePlugin({
      __DIANA_WIDGET_VERSION__: JSON.stringify(version),
    }),
    new webpack.BannerPlugin({
      banner: `DianaWidget v${version}${commit ? ` (${commit.slice(0, 7)})` : ''} | https://github.com/zuugle-services/DianaWidget`,
      // After minification, so terser neither strips nor extracts it into a LICENSE file.
      stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
    }),
    new WebpackManifestPlugin(), // Generates a manifest.json file
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1, // Tells Webpack to output at most 1 chunk (your main bundle)
    }),
  ]
};