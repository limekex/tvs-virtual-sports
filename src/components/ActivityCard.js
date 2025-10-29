export default function ActivityCard({ activity, uploadToStrava, uploading, React, compact, dummy }) {
  const { createElement: h, useState } = React;
  const meta = activity.meta || {};
  const activityId = activity.id;

  const syncedStrava = meta._tvs_synced_strava?.[0] || meta.synced_strava?.[0];
  const stravaRemoteId = meta._tvs_strava_remote_id?.[0] || meta.strava_activity_id?.[0];
  const isSynced = syncedStrava === '1' || syncedStrava === 1;

  const distance = meta._tvs_distance_m?.[0] || meta.distance_m?.[0] || 0;
  const duration = meta._tvs_duration_s?.[0] || meta.duration_s?.[0] || 0;
  const routeName = meta._tvs_route_name?.[0] || meta.route_name?.[0] || 'Unknown Route';
  const activityDate = meta._tvs_activity_date?.[0] || meta.activity_date?.[0] || activity.date || '';

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
      return h('div', { className: 'tvs-activity-card-compact', style: { padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '4px', background: 'linear-gradient(90deg, #f3f4f6 60%, #e5e7eb 100%)', fontSize: '0.9rem', position: 'relative', opacity: 0.6, filter: 'grayscale(0.7)', pointerEvents: 'none' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' } },
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { style: { fontWeight: '500', marginBottom: '0.25rem' } }, activityTitle),
            h('div', { style: { fontSize: '0.85rem', color: '#888' } },
              distance > 0 ? (distance / 1000).toFixed(2) + ' km' : '',
              distance > 0 && duration > 0 ? ' · ' : '',
              duration > 0 ? Math.floor(duration / 60) + ' min' : ''
            )
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 } },
            h('span', { style: { color: '#bbb', fontSize: '1.5rem', lineHeight: 1, display: 'flex', alignItems: 'center' }, title: 'Preview' }, '✓'),
            h('div', { style: { width: '32px', height: '32px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' } }, 'S')
          )
        )
      );
    }

    return h('div', { className: 'tvs-activity-card-compact', style: { padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '4px', backgroundColor: '#f9fafb', fontSize: '0.9rem', position: 'relative' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' } },
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontWeight: '500', marginBottom: '0.25rem' } }, activityTitle),
          h('div', { style: { fontSize: '0.85rem', color: '#666' } },
            distance > 0 ? (distance / 1000).toFixed(2) + ' km' : '',
            distance > 0 && duration > 0 ? ' · ' : '',
            duration > 0 ? Math.floor(duration / 60) + ' min' : ''
          )
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 } },
          isSynced
            ? h('span', { style: { color: '#10b981', fontSize: '1.5rem', lineHeight: 1, display: 'flex', alignItems: 'center' }, title: 'Synced to Strava' }, '✓')
            : null,
          h('div', { style: { position: 'relative' } },
            isSynced
              ? h('a', { href: stravaRemoteId ? 'https://www.strava.com/activities/' + stravaRemoteId : '#', target: '_blank', rel: 'noopener noreferrer', title: 'View on Strava', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '4px', backgroundColor: '#fc4c02', color: 'white', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold' } }, 'S')
              : h('button', { onClick: (e) => { e.stopPropagation(); setShowPopover(!showPopover); }, disabled: uploading, title: 'Upload to Strava', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '4px', backgroundColor: uploading ? '#ccc' : '#fc4c02', color: 'white', border: 'none', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 'bold' } }, uploading ? '...' : 'S'),
            showPopover && !isSynced && !uploading
              ? h('div', { style: { position: 'absolute', right: 0, top: 'calc(100% + 0.5rem)', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', zIndex: 1000, minWidth: '200px', whiteSpace: 'nowrap' } },
                  h('div', { style: { fontSize: '0.9rem', marginBottom: '0.5rem', color: '#374151' } }, 'Upload to Strava?'),
                  h('div', { style: { display: 'flex', gap: '0.5rem' } },
                    h('button', { onClick: (e) => { e.stopPropagation(); setShowPopover(false); uploadToStrava(activityId); }, style: { flex: 1, padding: '0.5rem 0.75rem', backgroundColor: '#fc4c02', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' } }, 'Upload'),
                    h('button', { onClick: (e) => { e.stopPropagation(); setShowPopover(false); }, style: { flex: 1, padding: '0.5rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' } }, 'Cancel')
                  )
                )
              : null
          )
        )
      ),
      showPopover ? h('div', { style: { position: 'fixed', inset: 0, zIndex: 999 }, onClick: () => setShowPopover(false) }) : null
    );
  }

  return h('div', { className: 'tvs-activity-card', style: { border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem', borderRadius: '4px', backgroundColor: isSynced ? '#f0f9ff' : '#fff' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', null,
        h('strong', null, activityTitle),
        h('div', { style: { marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' } },
          distance > 0 ? h('span', null, 'Distance: ' + (distance / 1000).toFixed(2) + ' km ') : null,
          duration > 0 ? h('span', null, 'Duration: ' + Math.floor(duration / 60) + ' min') : null
        )
      ),
      h('div', null,
        isSynced
          ? h('div', { style: { textAlign: 'right' } },
              h('span', { style: { color: '#10b981', fontWeight: 'bold' } }, '✓ Synced to Strava'),
              stravaRemoteId ? h('a', { href: 'https://www.strava.com/activities/' + stravaRemoteId, target: '_blank', rel: 'noopener noreferrer', style: { display: 'block', marginTop: '0.25rem', fontSize: '0.85rem' } }, 'View on Strava →') : null
            )
          : h('button', { className: 'tvs-btn tvs-btn-strava', onClick: () => uploadToStrava(activityId), disabled: uploading, style: { backgroundColor: '#fc4c02', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 } }, uploading ? 'Uploading...' : 'Upload to Strava')
      )
    )
  );
}
