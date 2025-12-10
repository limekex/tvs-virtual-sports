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

## Tests

### Running Tests

**PHPUnit** (REST API tests):
```sh
# From Docker container
docker compose exec wordpress bash -c "cd /var/www/html/wp-content/plugins/tvs-virtual-sports && vendor/bin/phpunit"

# Run specific test suite
vendor/bin/phpunit --filter TVS_REST_Manual_Activities_Tests
```

**Jest** (JavaScript unit tests):
```sh
# From plugin directory
npm test

# Watch mode
npm test -- --watch
```

### Test Coverage

- **PHPUnit**: 27 tests covering REST API endpoints
  - Route endpoints (GET /tvs/v1/routes)
  - Activity creation (POST /tvs/v1/activities)
  - Manual activity endpoints (start, update, finish)
  - Strava integration
  - Favorites API
- **Jest**: 36 tests covering JavaScript utilities
  - Time/pace formatting
  - Distance and pace calculations
  - Workout circuit metrics
  - Session state validation
  - Metric bounds checking

### Test Files
- `tests/phpunit/test-rest-manual-activities.php` - Manual activity REST tests
- `tests/phpunit/bootstrap.php` - WordPress test environment setup
- `tests/jest/ManualActivityTracker.test.js` - Frontend unit tests
- `jest.config.js` - Jest configuration
- `tests/jest/setup.js` - Test environment setup with mocks

For manual smoke testing:

1. Open a route page that mounts the app.
2. Start/pause/resume/finish; verify flash messages and that My Activities refreshes.
3. Try uploading a recent activity to Strava and confirm status updates.

## Internationalization (i18n)

- Text domain: `tvs-virtual-sports`
- Translations are loaded from `languages/` by the plugin. Any strings in related blocks (theme or plugin) using the same domain will resolve from here.
- For block metadata, ensure `block.json` contains a `"textdomain": "tvs-virtual-sports"` field.
- To generate/update a POT file, you can use WP-CLI:

  Optional (if you use WP-CLI locally):

  ```sh
  wp i18n make-pot wp-content/plugins/tvs-virtual-sports wp-content/plugins/tvs-virtual-sports/languages/tvs-virtual-sports.pot
  ```

## Favorites API (per-user)

Simple per-user favorites for routes are available via REST. These require authentication.

- Namespace: `tvs/v1`
- Storage: `user_meta` key `tvs_favorites_routes` (array of route IDs)

Endpoints:

- `GET /wp-json/tvs/v1/favorites`
  - Returns: `{ ids: number[] }`
  - Errors: `401` if not authenticated

- `POST /wp-json/tvs/v1/favorites/{id}`
  - Toggles favorite for the provided route ID
  - Returns: `{ favorited: boolean, ids: number[] }`
  - Errors: `400` if ID is not a `tvs_route`, `401` if not authenticated

- `DELETE /wp-json/tvs/v1/favorites/{id}`
  - Removes the route ID from favorites
  - Returns: `{ favorited: false, ids: number[] }`
  - Errors: `401` if not authenticated

Notes:
- All IDs are sanitized and stored as unique ints.
- For UI, SSR can preload the current user's `ids` to set initial state for bookmark buttons.

## Gutenberg Blocks

The plugin registers several server-rendered Gutenberg blocks:

### Favorites Blocks

**My Favourites** (`tvs-virtual-sports/my-favourites`)
- Displays routes favorited by the currently logged-in user
- Attributes: `layout` (grid/list), `columns`, `perPage`, `showPagination`, `showMeta`, `showBadges`, `showDifficulty`
- Requires authentication; shows login prompt for anonymous users
- Uses TVS UI tokens for consistent styling

**People's Favourites** (`tvs-virtual-sports/people-favourites`)
- Shows most-favorited routes across all users (ordered by `tvs_fav_count`)
- Attributes: Same as My Favourites, plus `showCounts` (displays favorite count badge)
- Public block (no authentication required)
- Query optimized via user_meta aggregation

**Fallback Images**
- All route blocks (Routes Grid, My Favourites, People's Favourites) use `/wp-content/uploads/2025/10/ActivityDymmy2-300x200.jpg` as fallback when routes don't have featured images
- Applied via `home_url()` for proper URL resolution

**CSS Notes**
- Favorites blocks use `.tvs-favourites-grid` class to exclude them from the aspect-ratio constraint applied to Routes Grid
- This ensures titles and metadata remain visible in grid layout

### Activity Blocks

**My Activities** (`tvs-virtual-sports/my-activities`)
- Shows recent user activities
- Server-rendered with React hydration

**Activity Timeline** (`tvs-virtual-sports/activity-timeline`)
- Displays chronological activity feed

**Activity Gallery** (`tvs-virtual-sports/activity-gallery`)
- Grid/list view of user activities

### Route Information Blocks

**Route Insights** (`tvs-virtual-sports/route-insights`)
- Elevation, surface type, ETA

**Personal Records** (`tvs-virtual-sports/personal-records`)
- Best time, average pace for a route

**Activity Heatmap** (`tvs-virtual-sports/activity-heatmap`)
- Sparkline/heatmap visualization

**Route Weather** (`tvs-virtual-sports/route-weather`)
- Historical weather data from MET Norway API

### Social Blocks

**Invite Friends** (`tvs-virtual-sports/invite-friends`)
- Invitation code generator (logged-in users only)

