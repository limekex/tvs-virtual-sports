# TVS Virtual Sports — Developer Guide

This plugin ships a small React app bundled with esbuild. This guide covers local development, watch mode, build output, and troubleshooting.

## Requirements

- Node.js 14.21.x (pinned for compatibility with esbuild 0.17.19)
- npm 6.x (ships with Node 14)
- WordPress dev environment (docker-compose defined at repo root)

If you use a different Node version, either switch to Node 14 for this project or bump esbuild with care (see Troubleshooting).

## Install

From the plugin folder:

```sh
npm ci
```

If you don't have a lockfile, run:

```sh
npm install
```

## Build

Bundle the client script to the path WordPress already enqueues:

```sh
npm run build
```

This produces:
- `public/js/tvs-app.js` (IIFE bundle, minified)
- `public/js/tvs-app.js.map` (source map)

WordPress PHP continues to enqueue the same path, so no enqueue changes are required.

## Watch (dev)

Run esbuild in watch mode (rebuilds on save):

```sh
npm run dev
```

If you're running the command from the monorepo root, use `--prefix`:

```sh
npm run dev --prefix ./wp-content/plugins/tvs-virtual-sports
```

When watch starts, hard-refresh the browser to pick up the new bundle.

## Project structure (js)

- `src/index.js` — thin entry; imports `./boot.js`
- `src/boot.js` — attaches DOMContentLoaded, mounts the app and the My Activities block
- `src/app.js` — main React component (video player, controls, save/upload flows)
- `src/components/` — UI building blocks (Loading, ProgressBar, ActivityCard, DevOverlay, MyActivities, MyActivitiesStandalone)
- `src/utils/` — debug logging, async helpers, and safe React mount glue

The build keeps the public output at `public/js/tvs-app.js` so PHP doesn’t change.

## Debugging

- Enable detailed logs via the URL: `?tvsdebug=1`
- Or press backtick (`) to enable dev overlay (persists via localStorage) or set the URL param when not in debug.
- Add `&tvsslow=500` to simulate slow REST calls (ms).

## Common issues

- "esbuild: unsupported Node version":
  - Use Node 14.21.x, or pin esbuild to `0.17.19` (already pinned).
- "npm run dev fails in repo root":
  - Run with `--prefix` from root: `npm run dev --prefix ./wp-content/plugins/tvs-virtual-sports`
- WordPress not loading the new JS:
  - Verify the bundle exists at `public/js/tvs-app.js` and hard-refresh. Check PHP enqueues in `includes/class-tvs-plugin.php`.

## Tests (future)

We plan to add tiny tests for utils (e.g., `withTimeout`) and a smoke render to improve confidence. For now, manual smoke testing:

1. Open a route page that mounts the app.
2. Start/pause/resume/finish; verify flash messages and that My Activities refreshes.
3. Try uploading a recent activity to Strava and confirm status updates.
