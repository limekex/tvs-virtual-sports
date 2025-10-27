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
2. Set the Authorization Callback Domain to your site's domain
3. Set the Redirect URI to: `https://your-site.example/connect-strava/`
4. In WordPress admin, navigate to TVS → Strava
5. Enter your Strava API Client ID and Client Secret
6. Configure upload templates and privacy settings
7. Save the settings

Users can then connect their Strava accounts by visiting the `/connect-strava/` page.

Note: The Strava API credentials are stored securely in WordPress options and are only accessible to administrators with the `manage_options` capability.

### Strava Settings
The plugin provides several configuration options:
- **Activity Name Template**: Customize the activity title using placeholders
- **Activity Description Template**: Customize the activity description
- **Privacy Setting**: Hide activities from public feed (note: cannot set to "Only You" via API)

Available template placeholders:
- `{route_title}` - The route name
- `{activity_id}` - Your activity ID
- `{distance_km}` - Distance with "km" unit
- `{duration_hms}` - Smart formatted duration
- `{date_local}` - Local date and time
- `{type}` - Activity type (VirtualRun, VirtualRide, etc.)
- `{route_url}` - Link to the route page

## Shortcodes
 `[tvs_my_activities]` — displays a compact list of the user's 5 most recent activities with Strava sync status

## Gutenberg Blocks
**TVS My Activities** — Standalone block for displaying recent activities. Shows the same content as the `[tvs_my_activities]` shortcode but can be inserted via the block editor.
## REST API (namespace `tvs/v1`)
## Features

### Progress Tracking
- **Visual Progress Bar**: Real-time indicator showing playback progress
	- Displays current time and total duration (e.g., "2:45 / 15:00")
	- Smooth updates during video playback
	- Gradient-styled progress fill
	- Works with slow-motion testing (`?tvsslow=1500`)
	- Progress percentage visible in DevOverlay when debug mode active

### Activity Session Management
- **Start**: Begin a new activity session and start video playback
- **Pause**: Pause video and session without saving
- **Resume**: Continue from where paused, preserving session start time
- **Finish & Save**: Save activity with cumulative duration
- Session timer accurately tracks total activity time across pause/resume cycles

### My Activities Display
- Compact activity cards showing 5 most recent activities
- Activity names formatted as "Route name (date)"
- Distance and duration statistics
- Strava sync status with visual indicators:
	- Green checkmark (✓) for synced activities
	- Orange "S" button for upload/view on Strava
- Click-to-upload with elegant popover confirmation
- Auto-refresh when activities are saved or synced
- Available as both Gutenberg block and shortcode

### Flash Notifications
- Elegant slide-in notifications replacing alert() dialogs
- Auto-fade after 3 seconds
- Green for success, red for errors
- Used for activity save and Strava upload confirmations

### Debug Mode
- Activate with URL parameter `?tvsdebug=1`
- Or press backtick (`) key to enable
- Shows developer overlay with route data, timing, and API status
- Debug logging only visible when active
- GET /wp-json/tvs/v1/routes
- GET /wp-json/tvs/v1/routes/{id}
- POST /wp-json/tvs/v1/activities
- GET /wp-json/tvs/v1/activities/me
- POST /wp-json/tvs/v1/strava/connect (OAuth token exchange)
- GET /wp-json/tvs/v1/strava/status (Check connection status)
- POST /wp-json/tvs/v1/activities/{id}/strava (Upload activity to Strava)

### Strava Integration
The plugin provides full Strava integration:
- **OAuth Connection**: Users connect via `/connect-strava/` page which exchanges code for tokens
- **Connection Status**: Shows "Reconnect" when already authenticated, displays athlete name and connection details
- **Activity Upload**: Authenticated users can upload their activities to Strava via `POST /activities/{id}/strava`
- **Virtual Activities**: Activities are uploaded as `VirtualRun` or `VirtualRide` with virtual icon on Strava
- **Privacy Control**: Option to hide activities from public feed (using `hide_from_home` parameter)
- **Ownership Verification**: Only activity owners can upload (403 if unauthorized)
- **Automatic Token Refresh**: Expired tokens are automatically refreshed
- **Activity Type Mapping**: TVS activity types are mapped to Strava virtual types
- **Sync Status**: Activities are marked with `_tvs_synced_strava` and `_tvs_strava_remote_id` meta fields
- **OAuth Scopes**: Requests `read`, `activity:write`, and `activity:read_all` permissions

**Privacy Note**: Due to Strava API limitations, activities cannot be set to "Only You" (fully private) via the API. The privacy setting hides activities from your public feed but they remain visible to anyone with a direct link. For full privacy, users must manually change the setting on Strava.

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
