import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import pkg from './package.json';
import { terser } from "rollup-plugin-terser";
import babel from "rollup-plugin-babel";

export default [{
  input: 'src/index.js',
  output: {
    //Change output library name
    name: 'resolver',
    file: pkg.browser,
    format: 'umd',
    // globals: {
    //   "axios": "axios"
    // }
  },
  // external: ["axios"],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    babel({
      babelrc: false,
      exclude: "node_modules/**",
      plugins: [
        require("@babel/plugin-proposal-class-properties"),
        require("@babel/plugin-proposal-function-bind"),
        require("@babel/plugin-proposal-object-rest-spread")
      ],
      extensions: ['.js', '.ts']
    }),
    commonjs(), // so Rollup can convert external deps to ES6
    terser()
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
  external: ["axios"]
}];