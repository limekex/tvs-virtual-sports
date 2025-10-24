# TVS Virtual Sports

WordPress plugin scaffold (MVP) for virtual routes, activity logging, and Strava integration.

See `readme.txt` for a short plugin header and `languages/` for translations.

## Install
- Copy `tvs-virtual-sports/` into `/wp-content/plugins/`
- Activate plugin

## Activation behavior
On activation the plugin seeds the `tvs_activity_type` taxonomy with `run`, `ride`, and `walk` terms and adds a simple capability `edit_tvs_routes` to the `administrator` role. This is a basic example — adjust as needed.

## Setup (Strava)
1. Create a Strava app at https://www.strava.com/settings/api
2. Set the Authorization Callback Domain to your site and the Redirect URI to: `https://your-site.example/wp-json/tvs/v1/strava/callback`
3. In WordPress admin, navigate to TVS → Strava
4. Enter your Strava API Client ID and Client Secret
5. Save the settings

Note: The Strava API credentials are stored securely in WordPress options and are only accessible to administrators with the `manage_options` capability.

## Shortcodes
- `[tvs_route id="123"]` — renders the React mount point and injects route JSON.

## REST API (namespace `tvs/v1`)
- GET /wp-json/tvs/v1/routes
- GET /wp-json/tvs/v1/routes/{id}
- POST /wp-json/tvs/v1/activities
- GET /wp-json/tvs/v1/activities/me
- POST /wp-json/tvs/v1/strava/connect
- POST /wp-json/tvs/v1/activities/{id}/strava

## Roadmap / TODOs
- Replace JS placeholder with a React app
- Implement UI in admin for route meta boxes
- Add unit tests and integration tests
- Secure Strava client secrets via env or secrets manager

## Running tests
This plugin contains PHPUnit test stubs under `tests/phpunit/`. To run tests you need the WordPress PHPUnit environment. Typical steps:

1. Install WP test suite and set WP_TESTS_DIR environment variable.
2. From the plugin root run phpunit with the bootstrap:

```bash
WP_TESTS_DIR=/path/to/wp-tests phpunit -c phpunit.xml tests/phpunit
```

These tests are stubs and expect a configured WP testing environment.
