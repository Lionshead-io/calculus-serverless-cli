const path = require('path');
const WebpackCleanupPlugin = require('webpack-cleanup-plugin');

module.exports = {
    entry: './index.js',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {test: /\.js$/, exclude: /node_modules/, loader: "babel-loader"}
        ]
    },
    plugins: [
        new WebpackCleanupPlugin()
    ],
    target: 'node',
    node: {
        fs: "empty"
    }
};