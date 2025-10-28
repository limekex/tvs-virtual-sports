# Manual Testing Checklist - v0.1.23

## Pre-Test Setup
- [ ] Plugin activated
- [ ] At least one route with Vimeo video exists
- [ ] Strava API credentials configured (TVS → Strava)
- [ ] User logged in

## Activity Session Management

### Start Activity
- [ ] Navigate to a route page
- [ ] Click "Start" button
- [ ] Video should start playing immediately
- [ ] Progress bar should begin advancing
- [ ] Session timer should start

### Pause & Resume
- [ ] Click "Pause" button during playback
- [ ] Video should pause
- [ ] Timer should stop
- [ ] Click "Resume" button
- [ ] Video should continue from paused position
- [ ] Timer should continue from where it stopped
- [ ] Session start time should be preserved

### Finish & Save
- [ ] After some playback time, click "Finish & Save"
- [ ] Flash notification "Activity saved!" should appear top-right
- [ ] Flash should fade out after 3 seconds
- [ ] No alert() popup should appear
- [ ] Activity should be saved with correct duration

## My Activities Block/Shortcode

### Block Display
- [ ] Edit a page in block editor
- [ ] Search for "TVS My Activities" block
- [ ] Insert the block
- [ ] Save and view page
- [ ] Block should show 5 most recent activities
- [ ] Activities should display as "Route name (date)"
- [ ] Distance and duration should be visible
- [ ] "Go to my activities →" link should appear at bottom

### Shortcode Display
- [ ] Add `[tvs_my_activities]` to a page
- [ ] View the page
- [ ] Should show same content as block
- [ ] Should be responsive and well-styled

### Activity Cards - Not Synced
- [ ] Find an activity not synced to Strava
- [ ] Should show orange "S" button only (no checkmark)
- [ ] Click "S" button
- [ ] Popover should appear with "Upload" and "Cancel" buttons
- [ ] Click outside popover to close
- [ ] Click "S" again and select "Upload"
- [ ] Flash notification "Uploaded to Strava!" should appear
- [ ] Activity card should update automatically (no page reload)

### Activity Cards - Synced
- [ ] Find a synced activity
- [ ] Should show green checkmark (✓) + orange "S" button
- [ ] Click "S" button
- [ ] Should open Strava activity in new tab
- [ ] No popover should appear for synced activities

### Auto-Refresh
- [ ] Open a page with My Activities block
- [ ] In another tab, complete and save a new activity
- [ ] Return to My Activities page
- [ ] Activity list should update automatically
- [ ] New activity should appear without page reload

## Flash Notifications

### Success Messages
- [ ] Save an activity
- [ ] "Activity saved!" flash should appear top-right, green background
- [ ] Upload to Strava
- [ ] "Uploaded to Strava!" flash should appear top-right, green background
- [ ] All flashes should fade out after ~3 seconds

### Error Messages
- [ ] Trigger an error (e.g., network issue)
- [ ] Error flash should appear top-right, red background
- [ ] Should include error message text
- [ ] Should fade out after ~3 seconds

### No Alert Popups
- [ ] Verify NO browser alert() dialogs appear during:
  - Activity save
  - Strava upload success
  - Strava upload failure (should show flash instead)

## Debug Mode

### Activation
- [ ] Add `?tvsdebug=1` to URL
- [ ] Debug overlay should appear
- [ ] Console should show debug logs
- [ ] OR press backtick (`) key
- [ ] Page should reload with debug active

### Debug Display
- [ ] Debug overlay should show route data
- [ ] `tvs-meta` JSON should be visible
- [ ] Console logs should be prefixed with `[TVS]`
- [ ] Without debug mode, these should be hidden

## Cross-Component Communication

### Event System
- [ ] Open browser console with debug mode
- [ ] Save an activity
- [ ] Look for `[TVS] My Activities block mount ID: ...` logs
- [ ] Verify event `tvs:activity-updated` fires
- [ ] All My Activities instances should reload

## Vimeo Player

### Video Playback
- [ ] Video should load in iframe
- [ ] Click "Start" - video should play immediately
- [ ] No hanging or delay before playback
- [ ] Progress bar should update smoothly
- [ ] Time display should update (e.g., "00:15 / 05:00")

### Player Controls
- [ ] Vimeo native controls should be hidden
- [ ] Only TVS buttons (Start/Pause/Resume/Finish) should control playback
- [ ] Video should pause on "Pause" click
- [ ] Video should resume on "Resume" click

## Responsive Design

### Desktop
- [ ] Activity cards should display correctly
- [ ] Flash notifications positioned top-right
- [ ] Strava buttons visible and clickable

### Mobile/Tablet
- [ ] Test on smaller screen sizes
- [ ] Activity cards should remain readable
- [ ] Buttons should be touch-friendly
- [ ] Flash notifications should not overlap content

## Data Persistence

### Activity Metadata
- [ ] Check saved activity in database
- [ ] Should have `route_name` meta field
- [ ] Should have `activity_date` meta field
- [ ] Should have `distance_m` and `duration_s`

### Strava Sync Status
- [ ] Upload activity to Strava
- [ ] Check activity meta
- [ ] Should have `_tvs_synced_strava = 1`
- [ ] Should have `_tvs_strava_remote_id` with Strava ID
- [ ] Should have `_tvs_synced_strava_at` timestamp

## Edge Cases

### Empty State
- [ ] User with no activities
- [ ] My Activities block should show: "No activities yet. Start your first workout!"

### Rapid Clicks
- [ ] Click "Upload" multiple times quickly
- [ ] Should not create duplicate uploads
- [ ] Button should be disabled during upload

### Network Errors
- [ ] Simulate network failure (DevTools → Offline)
- [ ] Try to save activity
- [ ] Should show error flash message
- [ ] Should not leave UI in broken state

## Test Summary

Date: _________________
Tester: _______________
Version: 0.1.23

### Results
- Total tests: _____ / _____
- Passed: _____
- Failed: _____

### Issues Found
1. 
2. 
3. 

### Notes
