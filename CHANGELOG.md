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
	- PHPUnit tests for endpoint (auth, missing code, invalid code)

### Changed
- Updated Strava configuration to use WordPress admin interface instead of constants

### Security
- Added capability checks for managing Strava settings (`manage_options`)
- Implemented proper sanitization for Strava API credentials