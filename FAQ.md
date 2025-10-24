# Frequently Asked Questions

## Where can I find the Strava settings?
The Strava API credentials can be configured in WordPress admin under the "TVS" menu. Navigate to TVS → Strava to enter your Client ID and Client Secret.

## Who can access the Strava settings?
Only administrators with the `manage_options` capability can access and modify the Strava API settings.

## How are the Strava credentials stored?
The Strava API credentials are stored securely in WordPress options using WordPress's built-in options API. They are stored as `tvs_strava_client_id` and `tvs_strava_client_secret`.

## How do I get Strava API credentials?
1. Go to https://www.strava.com/settings/api
2. Create a new application
3. Fill in the required information
4. Set the Authorization Callback Domain to your WordPress site's domain
5. Copy the Client ID and Client Secret
6. Enter these values in WordPress admin under TVS → Strava

## What if I previously used constants for Strava configuration?
If you were previously using `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` constants, you should:
1. Copy your existing credentials
2. Enter them in the new settings page (TVS → Strava)
3. Remove the constants from your configuration