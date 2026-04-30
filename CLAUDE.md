# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` - Bundle `src/widget-mapbox.ts` to `dist/widget-mapbox.js` via Rollup (ESM, with sourcemaps; copies `icons/` into `dist/`).
- `npm run watch` - Rollup watch mode (rebuild on change).
- `npm start` - Runs `watch` and `@web/dev-server` concurrently; opens `demo/index.html` (served from repo root, see `web-dev-server.config.mjs`).
- `npm run types` - Regenerate `src/definition-schema.d.ts` from `src/definition-schema.json` (`json2ts`). Run after editing the schema.
- `npm run analyze` - Custom Elements Manifest analyze (LitElement preset).
- `npm run release` - `npm version patch` (no `v` prefix), pushes commits + tag, then builds. Tag push triggers the GitHub Action that publishes to npm.
- `npm run link` / `npm run unlink` - Link/unlink against a sibling `../RESWARM/frontend` checkout for in-app testing.
- `npm run cors` - Updates GCS CORS for `gs://reswarm-images` (used to host the demo's `ObjectRandomizer.js`).

There is no test runner and no `lint` / `format` script in `package.json` (the README mentions them, but they don't exist). Node `>=24.9.0` is required.

## Architecture

This repo produces a single LitElement web component published as `@record-evolution/widget-mapbox`, consumed by the IronFlock/RESWARM dashboard platform.

### Versioned custom element tag

The component is registered as `widget-mapbox-versionplaceholder` in `src/widget-mapbox.ts`. At build time, Rollup's `@rollup/plugin-replace` substitutes `versionplaceholder` with the current `package.json` version everywhere it appears (the `@customElement` decorator argument, the `version` instance field, and CSS bundle ids). The host app picks the tag matching the installed version, so multiple widget versions can coexist on one page. The demo demonstrates this pattern with `unsafeStatic(\`widget-mapbox-${packageJson.version}\`)`.

### Platform contract: `inputData` + `theme`

The widget exposes two reactive `@property({ type: Object })` inputs:

- `inputData` - shape defined by `src/definition-schema.json` (the source of truth); `src/definition-schema.d.ts` is generated from it. The schema is rich (titles, descriptions, `order`, `dataDrivenDisabled`, `enum`, color flags) because the IronFlock dashboard renders configuration UIs directly from it. Update the JSON, then run `npm run types`.
- `theme` - `{ theme_name, theme_object }`. CSS custom properties `--re-text-color` and `--re-tile-background-color` take precedence over `theme_object` values (see `registerTheme`).

`update(changedProperties)` re-runs `transformInputData()` and `syncDataLayers()` on every `inputData` change, and re-creates the map only when `inputData.style` changes.

### Data pipeline

`InputData.dataseries[]` -> `transformInputData()` pivots each series by the `pivot` field of its points, derives a monochromatic palette (`tinycolor`) per pivot bucket, optionally trims to `latestValues`, and emits internal `DataSet`s. `createGEOJson()` turns each `DataSet` into a `FeatureCollection` (Points for `circle`/`symbol`/`heatmap`, a single `LineString` for `line`). `syncDataLayers()` diffs `dataSources` against the live Mapbox map and adds/updates/removes sources and layers via `addCircleLayer` / `addSymbolLayer` / `addHeatmapLayer` / `addTrackLayer`. `fitBounds()` runs after data changes when `inputData.follow` is enabled.

### Mapbox specifics

- `mapboxgl.accessToken` is hardcoded in the constructor.
- `mapbox-gl/dist/mapbox-gl.css` is imported as a string (Rollup `rollup-plugin-string` matches `\.css$`) and injected via `unsafeCSS` inside the component's `static styles`, so styles stay scoped to the shadow root.
- `icons/` (car-front, car-top, marker SVGs) is copied to `dist/icons` by `rollup-plugin-copy` and loaded as map images for the `symbol` layer. Icon color variants are generated at runtime by recoloring SVGs.
- A `ResizeObserver` on the map container debounces `map.resize()` + `fitBounds()` (300ms).

### Build pipeline

Single Rollup config (`rollup.config.js`): `replace` (version) -> `string` (CSS as string) -> `typescript` -> `nodeResolve` -> `commonjs` -> `babel` (bundled helpers) -> `copy` (icons). Output is a single ESM bundle; `package.json` `main` points to `dist/widget-mapbox.js`, `types` to `dist/src/widget-mapbox.d.ts`.

### Release flow

`npm run release` bumps the patch version with no tag prefix (`--tag-version-prefix=''`) and pushes the tag. `.github/workflows/build-publish.yml` triggers on any tag push, runs `npm install --omit-dev --frozen-lockfile`, `npm run build`, then `npm publish --access public` and creates a GitHub Release. The bare numeric tag is what the workflow expects.
