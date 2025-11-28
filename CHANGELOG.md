# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Manual Activity Tracker (Issue #21)**: Complete indoor workout tracking system
  - Activity types: Run, Ride, Walk, Hike, Swim, Workout
  - Live dashboard with real-time metrics (timer, distance, pace/speed, incline, cadence, power)
  - Session management: start, pause, resume, finish with auto-save every 30s
  - Session recovery from localStorage on page refresh
  - Manual activity REST endpoints:
    - `POST /tvs/v1/activities/manual/start` — Start new session with activity type validation
    - `PATCH /tvs/v1/activities/manual/{id}` — Update metrics during session
    - `POST /tvs/v1/activities/manual/{id}/finish` — Complete and save as `tvs_activity`
  - **Workout Circuits** (Bonus): Support for strength training with exercises, sets, reps, and volume tracking
  - Swim-specific metrics: laps, pool_length
  - Activity meta fields: `_tvs_is_manual`, `_tvs_manual_type`, `_tvs_manual_metrics`, `_tvs_manual_circuits`
  - Strava upload for manual activities (trainer=1 compliance)
  - Integration with "My Activities" block (manual activities appear alongside route-based)

### Testing
- **PHPUnit**: 11 new REST API tests for manual activity endpoints (27 total tests passing)
  - Authentication, validation, session management, activity creation, circuits
- **Jest**: 36 JavaScript unit tests for calculation functions
  - Time/pace formatting, distance calculations, workout metrics, state validation
- Jest infrastructure: configuration, jsdom environment, test setup with mocked globals

## [1.1.2] - 2025-11-04

### Added
- Favorites MVP (per-user):
	- REST endpoints under `tvs/v1` namespace
		- `GET /tvs/v1/favorites` — returns `{ ids: number[] }` for the current user
		- `POST /tvs/v1/favorites/{id}` — toggles favorite for a route ID, returns `{ favorited, ids }`
		- `DELETE /tvs/v1/favorites/{id}` — removes a route ID from favorites, returns `{ favorited: false, ids }`
	- Data stored in `user_meta` as `tvs_favorites_routes` (array of route IDs)
	- Input sanitization and auth guards (401 for unauthenticated)

### Changed
- Internationalization: standardized all strings to the `tvs-virtual-sports` text domain across PHP and JS.
	- Added `textdomain` to relevant `block.json` files and localized previously hardcoded strings
	- Localized pagination labels, aria-labels, and empty-state messages
	- Related blocks in the theme now also use this text domain so translations can be loaded from the plugin

### Fixed
- Avoided nested anchors in CTA areas where applicable to prevent invalid HTML and accidental navigation when toggling favorites.

## [1.1.0] - 2025-11-03

### Added
- UI token alignment for the app container and controls (icon buttons with labels, variants, hover).
- Strava settings page in WP Admin (Client ID/Secret, templates, privacy toggle) with validation/sanitization.
- Strava status in user profile and REST endpoints for connect/status/upload.

### Changed
- Reworked button variants to use theme tokens (primary/outline/success/warning) and consistent react-icons.
- Containerized the app (no title) with full-width video and progress indicator.

### Performance
- Added transient caching for `GET /tvs/v1/routes` responses (5 min TTL) with safe invalidation on `save_post_tvs_route` via a cache-buster option. Dev bypass via `?tvsforcefetch=1`.

### Security
- Capability checks for managing Strava settings; secure storage in options.

### Added
- REST API PHPUnit tests covering core endpoints
	- GET /tvs/v1/routes (list + item)
	- POST /tvs/v1/activities (auth required)
	- POST /tvs/v1/strava/connect (auth + mocked token exchange)
	- POST /tvs/v1/activities/{id}/strava (owner checks + mocked upload)
- Progress bar component with real-time playback indicator
	- Visual progress bar displays under video during playback
	- Shows current time / total duration (e.g., "2:45 / 15:00")
	- Updates smoothly via Vimeo player `timeupdate` events
	- Progress calculation: `(currentTime / duration) * 100`
	- Styled with gradient fill and rounded corners
	- Tested with `?tvsslow=1500` and `?tvsforcefetch=1` query params
	- DevOverlay shows progress percentage when debug mode active

- New admin menu "TVS" with Strava settings submenu
- Settings page for managing Strava API credentials (Client ID and Client Secret)
- Secure storage of Strava credentials in WordPress options
- Helper methods in TVS_Strava class for accessing API credentials

- Strava OAuth connection flow:
	- Landing page `/strava/connected` for OAuth callback
	- JS handler for code POST and redirect
	- REST endpoint `tvs/v1/strava/connect` for exchanging code and storing tokens in user_meta
	- Tokens stored as `user_meta['tvs_strava']`
	- OAuth scope now includes `activity:read_all` for full API access
	- PHPUnit tests for endpoint (auth, missing code, invalid code)

- Strava activity upload:
	- REST endpoint `POST /tvs/v1/activities/{id}/strava` for uploading activities to Strava
	- Ownership verification (403 if user doesn't own activity)
	- Automatic token refresh when expired
	- Activity type mapping (run → VirtualRun, ride → VirtualRide, walk, hike, ski)
	- Privacy control via `hide_from_home` parameter (hides from public feed)
	- Separate PUT request to update activity privacy after creation
	- Meta fields: `_tvs_synced_strava`, `_tvs_strava_remote_id`, `_tvs_synced_strava_at`
	- PHPUnit tests for upload endpoint (401, 403, 404, already synced)

- Strava settings:
	- Admin option to mark uploaded activities as private (hide from feed)
	- Template system for activity name and description with placeholders:
		- `{route_title}`, `{activity_id}`, `{date_local}`, `{type}`, `{route_url}`
		- `{distance_km}` - distance with "km" unit
		- `{duration_hms}` - smart duration formatting (mm:ss or h:mm:ss)
	- Help text explaining Strava API privacy limitations

- Strava connection status:
	- `/connect-strava/` page shows connection status when already authenticated
	- "Reconnect" button when already connected
	- REST endpoint `tvs/v1/strava/status` validates tokens against Strava API
	- Detects revoked access and prompts user to reconnect
	- User profile section showing Strava connection details (athlete name, ID, scope, token expiry)

### Changed

### Fixed
 - Fixed PHP parse error in `class-tvs-strava.php` (methods misplaced inside function)
 - Fixed WP_DEBUG constant redefinition warnings in `wp-config.php`
 - Fixed console SyntaxError by removing inline `<script>` tag from shortcode output
 - Fixed Strava privacy setting - now correctly uses `hide_from_home` parameter
 - Fixed OAuth scope to include `activity:read_all` for updating activities
 - Fixed Vimeo Player programmatic play blocked by `await setCurrentTime(0)`
 - Fixed session management to preserve session start time across pause/resume cycles

### Security
 - Added capability checks for managing Strava settings (`manage_options`)
 - Implemented proper sanitization for Strava API credentials

## [0.1.23] - 2025-10-27

### Added
 - **Activity Session Management**: Implemented pause/resume/finish workflow
	 - Pause: Pauses video and session without saving
	 - Resume: Continues from where paused, preserving session start time
	 - Finish & Save: Saves activity with cumulative duration
 - **Gutenberg Block & Shortcode**: "TVS My Activities" block for flexible placement
	 - Standalone React component with own state management
	 - Shortcode `[tvs_my_activities]` for template insertion
	 - Automatic updates via global event system when activities change
 - **Compact Activity Cards**: Redesigned activity display
	 - Shows only 5 most recent activities
	 - Compact design with activity name format: "Route name (date)"
	 - Strava sync icon (S) with popover for upload confirmation
	 - Green checkmark (✓) for synced activities
	 - "Go to my activities →" link for full list
 - **Flash Notifications**: Elegant inline messages replacing alert() popups
	 - Slide-in animation from top-right
	 - Auto-fade after 3 seconds
	 - Green for success, red for errors
	 - Works globally across all components
 - **Activity Metadata**: Enhanced activity tracking
	 - Stores route name and activity date
	 - Displays formatted date in activity cards
	 - Better activity identification in lists

### Changed
 - Removed `MyActivities` component from main route block (now separate block only)
 - Debug logging now conditional on DEBUG flag activation
 - `tvs-meta` overlay hidden unless debug mode active
 - Activity naming from "Activity #XX" to "Route name (date)"
 - All alert() dialogs replaced with flash notifications

### Fixed
 - Vimeo Player: Removed blocking `await` from `setCurrentTime(0)` call
 - Play button now works immediately without hanging
 - Session start time preserved correctly during pause/resume
 - Activities auto-refresh in all blocks when new activity saved or synced

### Technical
 - Global event system: `tvs:activity-updated` for cross-component communication
 - Global flash function: `window.tvsFlash(message, type)` for notifications
 - React component architecture improved with shared components
 - CSS animations for flash messages
 - Activity metadata fields: `route_name`, `activity_date`

### Fixed
- Fixed PHP parse error in `class-tvs-strava.php` (methods misplaced inside function)
- Fixed WP_DEBUG constant redefinition warnings in `wp-config.php`
- Fixed console SyntaxError by removing inline `<script>` tag from shortcode output
- Fixed Strava privacy setting - now correctly uses `hide_from_home` parameter
- Fixed OAuth scope to include `activity:read_all` for updating activities

### Security
- Added capability checks for managing Strava settings (`manage_options`)
- Implemented proper sanitization for Strava API credentials