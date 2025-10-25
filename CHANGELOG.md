# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- Updated Strava configuration to use WordPress admin interface instead of constants
- Changed default activity type from `Run` to `VirtualRun` for virtual activities
- Changed default activity type from `Ride` to `VirtualRide` for virtual cycling
- Improved checkbox sanitization in admin settings to handle empty values
- Enhanced privacy update logging with detailed response analysis

### Fixed
- Fixed PHP parse error in `class-tvs-strava.php` (methods misplaced inside function)
- Fixed WP_DEBUG constant redefinition warnings in `wp-config.php`
- Fixed console SyntaxError by removing inline `<script>` tag from shortcode output
- Fixed Strava privacy setting - now correctly uses `hide_from_home` parameter
- Fixed OAuth scope to include `activity:read_all` for updating activities

### Security
- Added capability checks for managing Strava settings (`manage_options`)
- Implemented proper sanitization for Strava API credentials