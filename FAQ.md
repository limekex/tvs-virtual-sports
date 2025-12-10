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

## How do I pause and resume an activity session?
You can now pause an activity without saving it. Use the following buttons:
- **Start**: Begins a new activity session and starts video playback
- **Pause**: Pauses the video and session timing (does not save)
- **Resume**: Continues from where you paused, preserving the original session start time
- **Finish & Save**: Saves the activity with total cumulative duration

The session timer accurately tracks your total activity time across pause/resume cycles.

## Why won't my video start playing when I click Start?
If the video loads but doesn't play when you click Start, this was a known issue that has been fixed in version 0.1.23. The problem was caused by `await setCurrentTime(0)` blocking the play operation. Ensure you're running the latest version of the plugin.

## How do I display my recent activities on a page?
There are two ways to display your activities:

1. **Gutenberg Block**: In the block editor, add the "TVS My Activities" block
2. **Shortcode**: Add `[tvs_my_activities]` to any page or post

Both methods show your 5 most recent activities with:
- Activity name in format "Route name (date)"
- Distance and duration stats
- Strava sync status (green checkmark ✓ for synced)
- Upload to Strava button for non-synced activities

## Do my activity lists update automatically?
Yes! When you save a new activity or upload to Strava, all "My Activities" blocks/shortcodes on the page automatically refresh to show the updated data. No page reload required.

## What does the green checkmark (✓) mean on activity cards?
The green checkmark indicates that the activity has been successfully synced to Strava. You'll see both the checkmark and an orange "S" button (which links to the activity on Strava).

## How do I upload an activity to Strava from the activity list?
Click the orange "S" button on any non-synced activity. A popup will appear asking you to confirm. Click "Upload" to sync the activity to Strava. You'll see an elegant notification when the upload is complete, and the checkmark will appear automatically.

## Can I see all my activities or just recent ones?
The "My Activities" block shows only your 5 most recent activities for a clean, compact display. Click the "Go to my activities →" link at the bottom to see your full activity history.

## How are activity names formatted?
Activities are now named in the format "Route name (date)", for example: "Eik Forest Trail (Oct 27, 2025)". This makes it much easier to identify activities at a glance compared to the old "Activity #123" format.

## How do I disconnect my Strava account?
Use the REST endpoint `POST /wp-json/tvs/v1/strava/disconnect` while authenticated. This deletes your stored Strava tokens from your WordPress user meta and the connection status will immediately reflect as disconnected on the `/connect-strava/` page.

## How do favorites/bookmarks work for routes?
Favorites are per-user and private by default. When you mark a route as a favorite, its ID is stored in your user meta under `tvs_favorites_routes`.

- API Namespace: `tvs/v1`
   - `GET /wp-json/tvs/v1/favorites` → `{ ids: number[] }` (requires login)
   - `POST /wp-json/tvs/v1/favorites/{id}` → toggles favorite: `{ favorited, ids }` (requires login)
   - `DELETE /wp-json/tvs/v1/favorites/{id}` → removes an ID: `{ favorited: false, ids }` (requires login)
- UI: Bookmark buttons can reflect your current state and toggle without navigating away.
- Data: Only valid `tvs_route` post IDs can be favorited; inputs are sanitized and stored as integers.

## Can I see other users' favorites?
Yes! We now have two favorite blocks:

1. **My Favourites** (`tvs-virtual-sports/my-favourites`): Shows routes you've favorited
2. **People's Favourites** (`tvs-virtual-sports/people-favourites`): Shows the most-favorited routes across all users

The People's Favourites block displays routes ordered by total favorite count (`tvs_fav_count`) and can optionally show a heart badge with the count (e.g., "❤️ 5").

## What are the favorite block attributes?
Both My Favourites and People's Favourites support these attributes:
- `layout`: "grid" or "list" (default: grid)
- `columns`: Number of columns in grid view (default: 3)
- `perPage`: Routes per page (default: 10)
- `showPagination`: Enable/disable pagination (default: true)
- `showMeta`: Show distance and elevation pills (default: true)
- `showBadges`: Show difficulty and surface badges (default: true)
- `showDifficulty`: Show difficulty badge specifically (default: true)

People's Favourites also has:
- `showCounts`: Display favorite count badge (default: true)

## How are favorite counts updated?
When you toggle a favorite via `POST /wp-json/tvs/v1/favorites/{id}`, the system:
1. Updates your personal favorites list in `user_meta`
2. Increments/decrements the global `tvs_fav_count` on the route post
3. Returns the updated state immediately

This ensures People's Favourites always shows accurate, real-time popularity.

## What happens if a route doesn't have a featured image?
All route blocks (Routes Grid, My Favourites, People's Favourites) now use a fallback image: `/wp-content/uploads/2025/10/ActivityDymmy2-300x200.jpg`

This ensures every route card has a visual element even if no featured image has been uploaded.

## Why does the Routes Grid block have different spacing than favorite blocks?
Routes Grid applies a 16:9 aspect ratio to cards for visual consistency. Favorite blocks use a special `.tvs-favourites-grid` class that excludes them from this constraint, allowing titles and metadata to display below the image without clipping.

This design choice ensures:
- Routes Grid maintains compact, uniform cards
- Favorite blocks show complete information including titles

## What text domain do translations use?
All strings use the `tvs-virtual-sports` text domain across PHP and JS (including related blocks). Translations are loaded from the plugin's `languages/` directory.