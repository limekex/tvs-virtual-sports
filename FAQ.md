# Frequently Asked Questions

## Where can I find the Strava settings?
The Strava API credentials can be configured in WordPress admin under the "TVS" menu. Navigate to TVS → Strava to enter your Client ID and Client Secret.

## Who can access the Strava settings?
Only administrators with the `manage_options` capability can access and modify the Strava API settings.


## How does the Strava connection flow work?
After logging in and authorizing via Strava, you are redirected to `/connect-strava/?code=...`.
On this page, a script automatically POSTs the code to the REST endpoint `/wp-json/tvs/v1/strava/connect`.
If successful, your Strava tokens are securely stored in your WordPress user meta (`tvs_strava`).
You are then redirected back to the connection page showing your connection status. If there is an error, you will see a retry option.

The OAuth flow now requests the following scopes: `read`, `activity:write`, and `activity:read_all` for full activity management.

## What if I'm already connected to Strava?
The `/connect-strava/` page will show your connection status including your athlete name. The button will change to "Reconnect to Strava" if you need to refresh your authorization.

**Important**: The status check validates your token against Strava's API. If you have revoked access on Strava, the page will detect this and show a warning message prompting you to reconnect.

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

## How do I upload an activity to Strava?
Once you've connected your Strava account:
1. Create an activity via the REST API: `POST /wp-json/tvs/v1/activities`
2. Upload it to Strava: `POST /wp-json/tvs/v1/activities/{id}/strava`
3. The system will automatically:
   - Verify you own the activity
   - Refresh your Strava tokens if needed
   - Map the activity type (run, ride, walk, etc.)
   - Upload to Strava with proper metadata
   - Mark the activity as synced (`_tvs_synced_strava`)

## What happens if I try to upload an activity I don't own?
You'll receive a `403 Forbidden` error. Only the activity owner can upload their activities to Strava.

## Can I upload the same activity multiple times?
If an activity is already synced (marked with `_tvs_synced_strava`), the API will return a success message with the existing Strava activity ID instead of creating a duplicate.

## What activity types are supported for Strava upload?
The plugin maps TVS activity types to Strava types:
- run/løp → VirtualRun
- ride/sykkel → VirtualRide
- walk/gå → Walk
- hike → Hike
- ski → NordicSki

Default is "VirtualRun" if no type is specified. Virtual activities will appear with a virtual icon on Strava.

## Can I customize the activity name and description uploaded to Strava?
Yes! In the admin settings (TVS → Strava), you can configure templates using placeholders:
- `{route_title}` - The route name
- `{activity_id}` - Your activity ID
- `{distance_km}` - Distance with "km" unit (e.g., "5.00 km")
- `{duration_hms}` - Smart formatted duration (e.g., "25m 0s" or "1h 30m 15s")
- `{date_local}` - Local date and time
- `{type}` - Activity type
- `{route_url}` - Link to the route page

## Will my uploaded activities be private on Strava?
The plugin has a "Hide from public feed" setting in the admin panel. When enabled:
- Activities are marked with `hide_from_home: true` on Strava
- They won't appear in your public activity feed
- They are still visible to anyone with a direct link (shown as "Everyone")

**Important**: Due to Strava API limitations, you cannot set activities to "Only You" (fully private) via the API. If you need full privacy, you must manually change the visibility setting on Strava after the activity is uploaded.

## Why does my activity show "Everyone" on Strava even though I enabled privacy?
This is expected behavior due to Strava API limitations. The "Hide from public feed" setting prevents the activity from appearing in your public feed, but it remains visible to anyone with a direct link. To make an activity completely private ("Only You"), you must change the visibility setting manually on Strava.

## What happens if I revoke access to the app on Strava?
When you visit `/connect-strava/`, the system will validate your stored token against Strava's API. If you have revoked access on Strava, you'll see a warning message and will need to reconnect by clicking "Connect with Strava" again. This ensures that the connection status is always accurate.