import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from '@rollup/plugin-typescript';
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";

export default {
    // if you use createSpaConfig, you can use your index.html as entrypoint,
    // any <script type="module"> inside will be bundled by rollup
    input: ['./src/widget-mapbox.ts'],
    treeshake: {
        moduleSideEffects: false
    },
    output: {
        dir: './dist',
        name: 'widget-mapbox_bundle',
        banner: `/* @license Copyright (c) 2020 Record Evolution GmbH. All rights reserved.*/`,
        format: 'esm'
    },
    plugins: [
        typescript(),
        nodeResolve(),
        commonjs({}),
        babel({ babelHelpers: 'bundled' })
    ]

    // alternatively, you can use your JS as entrypoint for rollup and
    // optionally set a HTML template manually
    // input: './app.js',
};