import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import pkg from './package.json';
import { terser } from "rollup-plugin-terser";
import babel from "rollup-plugin-babel";
import sourcemaps from 'rollup-plugin-sourcemaps';

export default [{
  input: 'src/index.js',
  output: {
    //Change output library name
    name: 'asset-uploader',
    file: pkg.browser,
    format: 'umd',
    sourcemap: true,
    global: {
      "@kubric/litedash": "litedash"
    }
  },
  external: ["@kubric/litedash"],
  plugins: [
    sourcemaps(),
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    babel({
      babelrc: false,
      exclude: "node_modules/**",
      presets: [
        require("@babel/preset-env")
      ],
      plugins: [
        require("@babel/plugin-proposal-class-properties"),
        require("@babel/plugin-proposal-function-bind"),
        require("@babel/plugin-proposal-object-rest-spread")
      ],
      extensions: ['.js', '.ts']
    }),
    commonjs(), // so Rollup can convert external deps to ES6
    // terser()
  ]
}, {
  input: 'src/index.js',
  output: [{
    file: pkg.main,
    format: 'cjs'
  }, {
    file: pkg.module,
    format: 'es'
  }],
  external: ["axios", "@kubric/litedash"]
}];