export default function ActivityCard({ activity, uploadToStrava, uploading, React, compact, dummy }) {
  const { createElement: h, useState } = React;
  const meta = activity.meta || {};
  const activityId = activity.id;
  const permalink = activity.permalink || '';

  const syncedStrava = meta._tvs_synced_strava?.[0] || meta.synced_strava?.[0];
  const stravaRemoteId = meta._tvs_strava_remote_id?.[0] || meta.strava_activity_id?.[0];
  const isSynced = syncedStrava === '1' || syncedStrava === 1;

  const distance = meta._tvs_distance_m?.[0] || meta.distance_m?.[0] || 0;
  const duration = meta._tvs_duration_s?.[0] || meta.duration_s?.[0] || 0;
  const routeName = meta._tvs_route_name?.[0] || meta.route_name?.[0] || 'Unknown Route';
  const activityDate = meta._tvs_activity_date?.[0] || meta.activity_date?.[0] || activity.date || '';
  const activityType = meta._tvs_activity_type?.[0] || meta.activity_type?.[0] || '';
  
  // Parse manual exercises if present
  const exercisesJson = meta._tvs_manual_exercises?.[0];
  let exercises = [];
  if (exercisesJson) {
    try {
      exercises = JSON.parse(exercisesJson);
    } catch (e) {
      exercises = [];
    }
  }
  const isManualWorkout = activityType === 'Workout' && exercises.length > 0;

  let formattedDate = '';
  if (activityDate) {
    try {
      const date = new Date(activityDate);
      formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      formattedDate = activityDate;
    }
  }
  const activityTitle = formattedDate ? `${routeName} (${formattedDate})` : routeName;

  if (compact) {
    const [showPopover, setShowPopover] = useState(false);

    if (dummy) {
      return h('div', { className: 'tvs-activity-card-compact is-dummy' },
        h('div', { className: 'tvs-activity-card__row' },
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { className: 'tvs-activity-card__title' },
              'Mock activity (demo) · ',
              h('span', { className: 'tvs-badge tvs-badge-info' }, 'Demo')
            ),
            h('div', { className: 'tvs-activity-card__meta tvs-text-muted' },
              distance > 0 ? (distance / 1000).toFixed(2) + ' km' : '',
              distance > 0 && duration > 0 ? ' · ' : '',
              duration > 0 ? Math.floor(duration / 60) + ' min' : ''
            )
          ),
          h('div', { className: 'tvs-activity-card__actions', style: { flexShrink: 0 } },
            h('span', { className: 'tvs-text-muted', title: 'Preview', style: { fontSize: '1.25rem', lineHeight: 1, display: 'flex', alignItems: 'center' } }, '✓'),
            h('div', { className: 'tvs-strava-square', style: { background: '#e5e7eb', color: '#ccc' } }, 'S')
          )
        )
      );
    }

    const clickableProps = permalink ? {
      onClick: () => { window.location.href = permalink; },
      role: 'link',
      tabIndex: 0,
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = permalink; } },
      style: { cursor: 'pointer' }
    } : {};

    return h('div', { className: 'tvs-activity-card-compact', ...clickableProps },
      h('div', { className: 'tvs-activity-card__row' },
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { className: 'tvs-activity-card__title' }, activityTitle),
          h('div', { className: 'tvs-activity-card__meta tvs-text-muted' },
            isManualWorkout
              ? `${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} · ${Math.floor(duration / 60)} min`
              : (
                  (distance > 0 ? (distance / 1000).toFixed(2) + ' km' : '') +
                  (distance > 0 && duration > 0 ? ' · ' : '') +
                  (duration > 0 ? Math.floor(duration / 60) + ' min' : '')
                )
          )
        ),
        h('div', { className: 'tvs-activity-card__actions', style: { flexShrink: 0 }, onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation() },
          isSynced
            ? h('span', { className: 'tvs-text-success', title: 'Synced to Strava', style: { fontSize: '1.25rem', lineHeight: 1, display: 'flex', alignItems: 'center' } }, '✓')
            : null,
          h('div', { style: { position: 'relative' } },
            isSynced
              ? h('a', { href: stravaRemoteId ? 'https://www.strava.com/activities/' + stravaRemoteId : '#', target: '_blank', rel: 'noopener noreferrer', title: 'View on Strava', className: 'tvs-strava-square' }, 'S')
              : h('button', { onClick: (e) => { e.stopPropagation(); setShowPopover(!showPopover); }, disabled: uploading, title: 'Upload to Strava', className: 'tvs-strava-square' }, uploading ? '...' : 'S'),
            showPopover && !isSynced && !uploading
              ? h('div', { className: 'tvs-popover' },
                  h('div', { className: 'tvs-popover__title' }, 'Upload to Strava?'),
                  h('div', { className: 'tvs-popover__actions' },
                    h('button', { onClick: (e) => { e.stopPropagation(); setShowPopover(false); uploadToStrava(activityId); }, className: 'tvs-btn tvs-btn-strava', style: { flex: 1 } }, 'Upload'),
                    h('button', { onClick: (e) => { e.stopPropagation(); setShowPopover(false); }, className: 'tvs-btn tvs-btn--muted', style: { flex: 1 } }, 'Cancel')
                  )
                )
              : null
          )
        )
      ),
      showPopover ? h('div', { style: { position: 'fixed', inset: 0, zIndex: 999 }, onClick: () => setShowPopover(false) }) : null
    );
  }

  return h('div', { className: 'tvs-activity-card' + (isSynced ? ' tvs-activity-card--synced' : '') },
    h('div', { className: 'tvs-activity-card__row' },
      h('div', null,
        h('strong', null, activityTitle),
        h('div', { className: 'tvs-activity-card__meta tvs-text-muted' },
          isManualWorkout
            ? h('span', null, `${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} · Duration: ${Math.floor(duration / 60)} min`)
            : (
                (distance > 0 ? h('span', null, 'Distance: ' + (distance / 1000).toFixed(2) + ' km ') : null) +
                (duration > 0 ? h('span', null, 'Duration: ' + Math.floor(duration / 60) + ' min') : null)
              )
        )
      ),
      h('div', { className: 'tvs-activity-card__right' },
        isSynced
          ? h('div', null,
              h('span', { className: 'tvs-text-success', style: { fontWeight: 'bold' } }, '✓ Synced to Strava'),
              stravaRemoteId ? h('a', { href: 'https://www.strava.com/activities/' + stravaRemoteId, target: '_blank', rel: 'noopener noreferrer', className: 'tvs-link tvs-text-sm', style: { display: 'block', marginTop: '0.25rem' } }, 'View on Strava →') : null
            )
          : h('button', { className: 'tvs-btn tvs-btn-strava', onClick: () => uploadToStrava(activityId), disabled: uploading }, uploading ? 'Uploading...' : 'Upload to Strava')
      )
    )
  );
}
