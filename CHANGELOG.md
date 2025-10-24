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

### Changed
- Updated Strava configuration to use WordPress admin interface instead of constants

### Security
- Added capability checks for managing Strava settings (`manage_options`)
- Implemented proper sanitization for Strava API credentials