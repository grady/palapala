const path = require('path');

module.exports = {
  entry: "./src/client.js",
  output: {
    filename: "client.js",
    path : path.resolve(__dirname, "dist")
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
}