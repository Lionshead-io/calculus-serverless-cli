const path = require('path');
const webpack = require('webpack');
const WebpackCleanupPlugin = require('webpack-cleanup-plugin');

module.exports = {
    entry: './index.js',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {test: /\.js$/, exclude: /node_modules/, loaders: ["shebang-loader", "babel-loader"]}
        ]
    },
    plugins: [
        new WebpackCleanupPlugin(),
        new webpack.BannerPlugin({banner: '#!/usr/bin/env node', raw: true})
    ],
    target: 'node',
    node: {
        fs: "empty"
    }
};