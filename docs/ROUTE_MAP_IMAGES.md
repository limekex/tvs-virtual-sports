# Route Map Images - Architecture

## Overview

The system automatically generates static map images from route GPS data using Mapbox Static Images API. These images are used for route visualization, activity sharing, and Strava uploads.

## Image Storage Strategy

### Routes (tvs_route post type)
**Two types of images:**

1. **Featured Image** (WordPress standard)
   - Seasonal "hero" image for visual appeal
   - Set by `maybe_set_season_thumbnail()` based on route creation date
   - Used in frontend route listings and cards

2. **Route Map Image** (Custom meta)
   - Technical GPS-based map visualization
   - Stored in custom meta fields:
     - `_tvs_route_map_url` - Mapbox API URL (regeneratable)
     - `_tvs_route_map_attachment_id` - WordPress attachment ID
     - `_tvs_route_map_attachment_url` - Permanent WordPress URL
   - Displayed in admin sidebar metabox
   - Used for sharing and technical reference

### Activities (tvs_activity post type)
**Single map image in meta:**
- `_tvs_map_image_url` - Mapbox API URL
- `_tvs_map_image_attachment_id` - WordPress attachment ID
- Used when sharing to Strava (included in description via `{map_image_url}` template variable)

## Generation Triggers

### Automatic Generation

1. **Strava Route Import** (`strava_import_route()`)
   - When importing a route from Strava
   - Uses `polyline` or `summary_polyline` from Strava API
   - Red line (#F56565), 1200x800px

2. **Strava Activity Import** (`strava_import_activity()`)
   - When importing an activity as a route
   - Uses polyline from activity streams
   - Red line (#F56565), 1200x800px

3. **Activity Save** (`create_activity()`)
   - When user completes a virtual training session
   - Uses polyline from parent route
   - Green line (#84cc16), 1200x800px

### Manual Generation

**Admin UI** - Route edit screen sidebar:
- "Generate Map Image" button (if no map exists)
- "Regenerate Map" button (if map exists)
- AJAX handler: `ajax_regenerate_route_map()`

## Mapbox Static Images API

### API Format
```
https://api.mapbox.com/styles/v1/{style}/static/{overlay}/{auto}/{width}x{height}?padding={padding}&access_token={token}
```

### Route Overlay Format
```
path-{width}+{color}-{opacity}(%7Benc:{polyline}%7D)
```

Example:
```
path-4+F56565-0.9(%7Benc:_p~iF~ps|U_ulLn...%7D)
```

### Configuration Options

```php
array(
    'width'          => 1200,        // Image width in pixels
    'height'         => 800,         // Image height in pixels
    'style'          => 'mapbox/outdoors-v12', // Map style
    'stroke_color'   => 'F56565',    // Line color (hex without #)
    'stroke_width'   => 4,           // Line width in pixels
    'stroke_opacity' => 0.9,         // Opacity 0-1
    'padding'        => 50,          // Padding around route (pixels)
)
```

### Color Scheme

- **Routes**: Red (#F56565) - Incomplete/planned route
- **Activities**: Green (#84cc16) - Completed route

## Implementation Files

### Core Class
**`class-tvs-mapbox-static.php`**
- `generate_from_polyline()` - Generate URL from encoded polyline
- `generate_from_coordinates()` - Generate URL from coordinate array
- `save_as_attachment()` - Download image and save as WP attachment
- `generate_and_set_featured_image()` - Generate and optionally set as featured
- `generate_activity_image()` - Generate and save in activity meta
- `encode_polyline()` - Encode coordinates to Google Polyline format

### Integration Points
**`class-tvs-rest.php`**
- `strava_import_route()` line ~2190 - Generate map on route import
- `strava_import_activity()` line ~2365 - Generate map on activity import
- `create_activity()` line ~1575 - Generate map on activity save

**`class-tvs-strava.php`**
- `upload_activity()` line ~226 - Include map URL in Strava upload description
- Template variable: `{map_image_url}` available in description template

**`class-tvs-cpt-route.php`**
- `add_meta_boxes()` line ~118 - Register "Route Map" metabox
- `render_route_map_meta_box()` line ~228 - Render map preview and buttons
- `ajax_regenerate_route_map()` line ~318 - AJAX handler for regeneration

**`class-tvs-plugin.php`**
- Line ~16 - `require_once` for mapbox-static class

## Admin UI

### Route Edit Screen - Sidebar Metabox

**With Map Image:**
```
┌─────────────────────┐
│ [Map Preview Image] │
├─────────────────────┤
│ This map was gen... │
│                     │
│ [View Full Size]    │
│ [Regenerate Map]    │
└─────────────────────┘
```

**Without Map Image:**
```
┌─────────────────────┐
│ No map image yet... │
│                     │
│ [Generate Map Image]│
└─────────────────────┘
```

## Strava Integration

### Upload Description Template

**Default:**
```
Uploaded from TVS Virtual Sports (Activity ID: {activity_id})
```

**Example with map:**
```
Completed {route_title}!

Distance: {distance_km}
Time: {duration_hms}

Route: {route_url}
Map: {map_image_url}

Uploaded from TVS Virtual Sports
```

**Available Variables:**
- `{route_title}` - Route name
- `{route_url}` - Permanent route URL
- `{activity_id}` - Activity post ID
- `{distance_km}` - Distance with unit (e.g., "5.2 km")
- `{duration_hms}` - Duration formatted (e.g., "45m 23s")
- `{date_local}` - Activity date/time
- `{type}` - Activity type (VirtualRun, VirtualRide, etc.)
- `{map_image_url}` - **Route map image URL** ⭐

## Testing Checklist

### Route Import
- [ ] Import route from Strava
- [ ] Verify map appears in sidebar metabox
- [ ] Click "View Full Size" - opens in new tab
- [ ] Check meta fields populated: `_tvs_route_map_*`
- [ ] Verify featured image is seasonal (not map)

### Map Regeneration
- [ ] Click "Regenerate Map" button
- [ ] Verify AJAX request succeeds
- [ ] Page reloads showing updated map
- [ ] Check attachment created in Media Library

### Activity Save
- [ ] Complete virtual training session
- [ ] Save activity
- [ ] Check activity meta: `_tvs_map_image_*` fields
- [ ] Verify map uses green line color

### Strava Upload
- [ ] Update description template to include `{map_image_url}`
- [ ] Upload activity to Strava
- [ ] Check Strava activity description contains map URL
- [ ] Click map URL - verifies image loads

## Future Enhancements

### Watermark Support
Currently not implemented. Mapbox Static API doesn't support text overlays directly. Options:

1. **PHP Image Processing** (GD/Imagick)
   - Download image from Mapbox
   - Add text watermark with GD or Imagick
   - Save modified image

2. **Custom Marker Overlay**
   - Add transparent logo marker at corner
   - Requires uploading logo to Mapbox

3. **Post-Processing Service**
   - Use external service to add watermark
   - Add as extra step after Mapbox generation

### Multiple Map Styles
Currently uses `outdoors-v12` only. Could add:
- Admin setting to choose default style
- Per-route style selection
- Style variants for different activity types

### Progressive Enhancement
- Generate smaller thumbnail on save (fast)
- Generate full resolution on demand (slow)
- Cache multiple sizes for different uses

## Troubleshooting

### Map Not Generating
**Check:**
1. Mapbox access token configured (TVS → Settings)
2. Route has `polyline` or `summary_polyline` meta
3. Check PHP error log for API errors
4. Verify Mapbox token has correct scopes

### Wrong Featured Image
**Expected behavior:**
- Featured image = Seasonal hero image
- Map image = In custom meta (sidebar metabox)

If you want map as featured image:
```php
$mapbox_static->generate_and_set_featured_image( $post_id, $polyline, $options, true );
// Last parameter = force as featured image
```

### Strava Upload Missing Map
**Check:**
1. Activity has `_tvs_map_image_url` meta
2. Description template includes `{map_image_url}` variable
3. URL is accessible (not localhost-only)

### Image Quality Issues
**Adjust in code:**
```php
array(
    'width'  => 1920,  // Increase resolution
    'height' => 1080,
    'stroke_width' => 5, // Thicker line
)
```

## Security Considerations

### Path Traversal Protection
- `realpath()` validation in `save_as_attachment()`
- Only allows files in WordPress uploads directory
- Sanitizes all user inputs

### Token Security
- Mapbox token stored in `wp_options` table
- Only accessible to administrators
- Token not exposed in frontend JavaScript (server-side API calls only)

### AJAX Security
- Nonce verification: `wp_verify_nonce()`
- Capability check: `current_user_can('edit_posts')`
- Post type validation: `get_post_type() === 'tvs_route'`

## Performance

### Caching Strategy
- Generated images stored as WP attachments (permanent)
- Mapbox API URL also cached in meta (regeneratable)
- No repeated API calls unless regeneration requested

### API Rate Limits
Mapbox Static Images API:
- Free tier: 50,000 requests/month
- Pro tier: 100,000 requests/month
- Attachment caching ensures minimal API usage

### Image Sizes
- Default: 1200x800 (96KB-200KB depending on route complexity)
- WordPress automatically generates thumbnails
- Original stored in uploads directory
