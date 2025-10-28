import { registerBlockType } from '@wordpress/blocks';
import { useEffect, useState } from '@wordpress/element';

registerBlockType('tvs-virtual-sports/my-activities', {
  title: 'TVS My Activities',
  icon: 'list-view',
  category: 'widgets',
  edit: () => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      fetch('/wp-json/tvs/v1/activities/me', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => {
          setActivities(Array.isArray(data) ? data : (data.activities || []));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, []);
    return (
      <div className="tvs-activities-block">
        <h3>My Activities</h3>
        {loading ? <p>Loading...</p> : activities.length === 0 ? <p>No activities yet.</p> : (
          <ul>
            {activities.map(a => (
              <li key={a.id}>Activity #{a.id} ({a.meta?.distance_m || 0} m, {a.meta?.duration_s || 0} s)</li>
            ))}
          </ul>
        )}
      </div>
    );
  },
  save: () => null // Dynamic block
});
