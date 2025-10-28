# Release Notes - v0.1.23

## 🎉 Summary
This release introduces major improvements to activity session management, adds a reusable "My Activities" component, and replaces all alert dialogs with elegant flash notifications. The Vimeo Player issue preventing programmatic playback has been fixed.

## ✅ Test Results

### Automated Tests
```
PHPUnit 9.6.29
✔ Get routes returns array
✔ Create activity requires auth
✔ Settings registration
✔ Options crud
✔ Admin menu registration
✔ Capability checking
✔ Settings sanitization

OK (7 tests, 15 assertions)
```

### Manual Testing
See [MANUAL_TESTING.md](./MANUAL_TESTING.md) for comprehensive testing checklist.

## 🚀 Key Features

### 1. Activity Session Management
**Problem Solved**: Previously, stopping an activity immediately saved it. Users needed the ability to pause and resume without saving.

**Solution**: 
- Implemented three-button workflow: Pause, Resume, Finish & Save
- Pause stops the session without saving
- Resume continues from paused position, preserving session start time
- Finish & Save creates the activity with cumulative duration

**Technical Details**:
- Session start time (`sessionStartAt`) preserved across pause/resume cycles
- Cumulative duration calculation works correctly
- Video playback synchronized with session state

### 2. Vimeo Player Fix
**Problem**: Video loaded but wouldn't play when clicking "Start" button. The operation would hang indefinitely.

**Root Cause**: `await player.setCurrentTime(0)` was blocking execution. The promise never resolved.

**Solution**: Removed `await` from `setCurrentTime(0)` call. Video now plays immediately without waiting for the seek operation to complete.

```javascript
// Before (blocked)
await player.setCurrentTime(0);
await player.play();

// After (works)
player.setCurrentTime(0); // Don't await
player.play(); // Executes immediately
```

### 3. My Activities Component
**Problem**: Activities list was embedded in route block, couldn't be placed elsewhere.

**Solution**: Created standalone component available as both Gutenberg block and shortcode.

**Features**:
- Shows 5 most recent activities
- Compact design with activity name format: "Route name (Oct 27, 2025)"
- Strava sync status with visual indicators (✓ checkmark + S button)
- Auto-refresh via global event system
- Works in any page/template

**Usage**:
- Gutenberg: Search for "TVS My Activities" block
- Shortcode: Add `[tvs_my_activities]` anywhere

### 4. Flash Notifications
**Problem**: Browser `alert()` dialogs are intrusive and block the UI.

**Solution**: Elegant slide-in notifications that auto-fade after 3 seconds.

**Technical Implementation**:
```javascript
// Global flash function available everywhere
window.tvsFlash(message, type);

// Examples
window.tvsFlash("Activity saved!"); // Success (green)
window.tvsFlash("Upload failed", "error"); // Error (red)
```

**Features**:
- Smooth CSS animations (slide in from top-right)
- Green for success, red for errors
- Auto-fade after 3 seconds
- Non-blocking - users can continue working
- Works across all components (main app + standalone blocks)

### 5. Enhanced Activity Metadata
**New Fields**:
- `route_name`: Stored when activity is created
- `activity_date`: ISO timestamp of activity creation

**Display Format**: "Eik Forest Trail (Oct 27, 2025)" instead of "Activity #123"

**Benefits**:
- Easier to identify activities at a glance
- Better user experience in activity lists
- More meaningful activity cards

### 6. Auto-Refresh System
**Problem**: After saving/uploading, activity lists didn't update without page reload.

**Solution**: Global event system using CustomEvents.

**Technical Details**:
```javascript
// Trigger event after save/upload
window.dispatchEvent(new CustomEvent('tvs:activity-updated'));

// All components listen for the event
window.addEventListener('tvs:activity-updated', loadActivities);
```

**Result**: All "My Activities" blocks/shortcodes on the page refresh automatically when:
- New activity is saved
- Activity is uploaded to Strava
- Activity metadata changes

## 📋 Updated Documentation

### CHANGELOG.md
- Added comprehensive v0.1.23 release notes
- Categorized changes: Added, Changed, Fixed, Technical

### FAQ.md
- Added session management questions
- Added My Activities block/shortcode usage
- Added troubleshooting for Vimeo playback issue
- Added activity naming format explanation

### README.md
- Added Features section with detailed descriptions
- Updated Shortcodes section with `[tvs_my_activities]`
- Added Gutenberg Blocks section
- Added Debug Mode documentation

### MANUAL_TESTING.md
- New comprehensive testing checklist
- Covers all new features
- Includes edge cases and error scenarios
- Test summary template for QA tracking

## 🐛 Bug Fixes

1. **Vimeo Player**: Fixed blocking `await` preventing video playback
2. **Session Timer**: Fixed session start time not preserved during pause/resume
3. **Activity Refresh**: Fixed activity lists not updating after save/upload
4. **Debug Logging**: Fixed debug logs showing to end users (now only with DEBUG flag)

## 🔧 Technical Improvements

1. **Event System**: Global `tvs:activity-updated` event for cross-component communication
2. **Global Flash**: `window.tvsFlash()` accessible from any component
3. **Component Architecture**: Shared `MyActivities` component used by both main app and standalone block
4. **State Management**: Each block instance manages own state independently
5. **CSS Animations**: Keyframe animations for flash messages
6. **Metadata Storage**: Extended activity meta fields for better tracking

## 🎯 Migration Notes

### For Users
- No migration required
- Existing activities will show "Unknown Route" until new activities are created
- All functionality backward compatible

### For Developers
- Global `window.tvsFlash(message, type)` available for custom notifications
- Event `tvs:activity-updated` can be listened to for custom integrations
- New activity meta fields: `route_name`, `activity_date`

## 📊 Version History

- **v0.1.23**: Session management, My Activities block, Flash notifications
- **v0.1.22**: Strava sync icons, compact activity cards
- **v0.1.21**: Auto-refresh system
- **v0.1.20**: Activity metadata (route_name, activity_date)
- **v0.1.19**: Removed MyActivities from main route block
- **v0.1.18**: Fixed MyActivities component scope issue
- **v0.1.17**: Debug output for block troubleshooting
- **v0.1.16**: Initial Gutenberg block registration
- **v0.1.14-15**: Pause/resume implementation
- **v0.1.13**: Fixed Vimeo Player API integration

## 🎬 Demo Workflow

1. **Start Activity Session**
   - Navigate to route page
   - Click "Start" → Video plays immediately
   - Progress bar and timer advance

2. **Pause & Resume**
   - Click "Pause" → Video stops, timer freezes
   - Click "Resume" → Video continues, timer resumes from same point

3. **Save Activity**
   - Click "Finish & Save"
   - Flash notification: "Activity saved!" (green, top-right)
   - Notification fades out after 3 seconds

4. **View Activities**
   - Navigate to page with My Activities block
   - See new activity: "Eik Forest Trail (Oct 27, 2025)"
   - Distance: "5.00 km · Duration: 25 min"

5. **Upload to Strava**
   - Click orange "S" button
   - Popover appears: "Upload to Strava?"
   - Click "Upload"
   - Flash notification: "Uploaded to Strava!"
   - Green checkmark (✓) appears next to S button

6. **Auto-Refresh**
   - All My Activities blocks update automatically
   - No page reload needed

## ✅ Ready for Release

All automated tests pass, documentation updated, manual testing checklist provided. Ready to merge and close issue.
