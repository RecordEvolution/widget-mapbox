import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from '@rollup/plugin-typescript';
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";

export default {
    input: './src/widget-mapbox.ts',
    output: {
        dir: './dist',
        name: 'widget-mapbox_bundle',
        banner: `/* @license Copyright (c) 2020 Record Evolution GmbH. All rights reserved.*/`,
        format: 'esm'
    },
    preserveEntrySignatures: 'strict',
    plugins: [
        typescript(),
        babel({ 
            exclude: ['node_modules/mapbox-gl/**'],
            plugins: ['@babel/plugin-syntax-import-assertions'],
            babelHelpers: 'bundled',
        }),
        nodeResolve(),
        commonjs({}),
    ]
};