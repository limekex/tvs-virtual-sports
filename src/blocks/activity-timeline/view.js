/**
 * Activity Timeline Block - Frontend View
 * 
 * Displays activities in reverse chronological order with timeline visualization
 */

const { createElement: h, useState, useEffect } = window.React;

function ActivityTimelineBlock({ userId, limit, title, showNotes, showFilters }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedType, setSelectedType] = useState('all');

    useEffect(() => {
        fetchActivities();
    }, [limit]);

    const fetchActivities = async () => {
        setLoading(true);
        setError(null);

        try {
            const url = `${window.TVS_SETTINGS.restRoot}tvs/v1/activities/me?per_page=${limit}`;
            const response = await fetch(url, {
                headers: { 'X-WP-Nonce': window.TVS_SETTINGS.nonce }
            });

            if (!response.ok) throw new Error('Failed to fetch activities');

            const data = await response.json();
            setActivities(data || []);
        } catch (err) {
            console.error('Error fetching activities:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Group activities by date
    const groupedActivities = groupByDate(activities);

    // Filter by type if selected
    const filteredGroups = selectedType === 'all' 
        ? groupedActivities 
        : groupedActivities.map(group => ({
            ...group,
            activities: group.activities.filter(a => {
                let actType = a.meta.activity_type;
                if (Array.isArray(actType) && actType.length > 0) {
                    actType = actType[0];
                }
                if (typeof actType !== 'string') {
                    actType = 'workout';
                }
                return actType.toLowerCase() === selectedType.toLowerCase();
            })
        })).filter(group => group.activities.length > 0);

    if (loading) {
        return h('div', { className: 'tvs-timeline-loading' },
            h('div', { className: 'tvs-loading-spinner' })
        );
    }

    if (error) {
        return h('div', { className: 'tvs-timeline-error' },
            h('p', null, `Error: ${error}`)
        );
    }

    if (activities.length === 0) {
        return h('div', { className: 'tvs-timeline-empty' },
            h('p', null, 'No activities found.')
        );
    }

    return h('div', { className: 'tvs-activity-timeline' },
        h('div', { className: 'tvs-timeline-header' },
            h('h2', { className: 'tvs-timeline-title' }, title),
            showFilters && h('div', { className: 'tvs-timeline-filters' },
                h('select', {
                    className: 'tvs-type-filter',
                    value: selectedType,
                    onChange: (e) => setSelectedType(e.target.value)
                },
                    h('option', { value: 'all' }, 'All Activities'),
                    h('option', { value: 'run' }, '🏃 Run'),
                    h('option', { value: 'ride' }, '🚴 Ride'),
                    h('option', { value: 'walk' }, '🚶 Walk'),
                    h('option', { value: 'hike' }, '⛰️ Hike'),
                    h('option', { value: 'swim' }, '🏊 Swim'),
                    h('option', { value: 'workout' }, '💪 Workout')
                )
            )
        ),
        h('div', { className: 'tvs-timeline-content' },
            filteredGroups.map((group, idx) =>
                h(TimelineGroup, { key: idx, group, showNotes })
            )
        )
    );
}

function TimelineGroup({ group, showNotes }) {
    return h('div', { className: 'tvs-timeline-group' },
        h('div', { className: 'tvs-timeline-date-marker' },
            h('span', { className: 'tvs-date-label' }, group.label),
            h('div', { className: 'tvs-timeline-line' })
        ),
        h('div', { className: 'tvs-timeline-activities' },
            group.activities.map(activity =>
                h(ActivityCard, { key: activity.id, activity, showNotes })
            )
        )
    );
}

function ActivityCard({ activity, showNotes }) {
    const [expanded, setExpanded] = useState(false);
    const meta = activity.meta || {};
    
    // Handle activity_type - could be string, array, or object
    let activityTypeRaw = meta.activity_type || 'workout';
    if (Array.isArray(activityTypeRaw) && activityTypeRaw.length > 0) {
        activityTypeRaw = activityTypeRaw[0];
    }
    if (typeof activityTypeRaw === 'object' && activityTypeRaw !== null) {
        activityTypeRaw = 'workout';
    }
    const activityType = String(activityTypeRaw).toLowerCase();
    
    // Handle numeric values that might be arrays
    const distance = meta.distance_m ? (parseFloat(Array.isArray(meta.distance_m) ? meta.distance_m[0] : meta.distance_m) / 1000).toFixed(2) : 0;
    const duration = formatDuration(parseInt(Array.isArray(meta.duration_s) ? meta.duration_s[0] : meta.duration_s) || 0);
    const rating = parseInt(Array.isArray(meta.rating) ? meta.rating[0] : meta.rating) || 0;
    
    // Handle notes - could be string, array, or missing
    let notesRaw = meta.notes || '';
    if (Array.isArray(notesRaw) && notesRaw.length > 0) {
        notesRaw = notesRaw[0];
    }
    const notes = String(notesRaw || '');
    
    // Handle source
    let sourceRaw = meta.source || 'manual';
    if (Array.isArray(sourceRaw) && sourceRaw.length > 0) {
        sourceRaw = sourceRaw[0];
    }
    const source = String(sourceRaw);

    // Type icons and colors
    const typeConfig = {
        'run': { icon: '🏃', color: '#3b82f6', label: 'Run' },
        'ride': { icon: '🚴', color: '#10b981', label: 'Ride' },
        'walk': { icon: '🚶', color: '#f59e0b', label: 'Walk' },
        'hike': { icon: '⛰️', color: '#f97316', label: 'Hike' },
        'swim': { icon: '🏊', color: '#06b6d4', label: 'Swim' },
        'workout': { icon: '💪', color: '#a855f7', label: 'Workout' }
    };

    const config = typeConfig[activityType] || typeConfig.workout;

    const sourceLabels = {
        'manual': 'Manual Tracker',
        'virtual': 'Virtual Route',
        'video': 'Video Mode'
    };

    return h('div', { 
        className: 'tvs-activity-card',
        style: { borderLeftColor: config.color }
    },
        h('div', { className: 'tvs-activity-card-header' },
            h('div', { className: 'tvs-activity-type' },
                h('span', { className: 'tvs-type-icon' }, config.icon),
                h('span', { className: 'tvs-type-label' }, config.label)
            ),
            h('span', { className: 'tvs-activity-source' }, sourceLabels[source] || source),
            h('time', { className: 'tvs-activity-time' }, formatTime(activity.date))
        ),
        h('div', { className: 'tvs-activity-card-body' },
            h('div', { className: 'tvs-activity-metrics' },
                distance > 0 && h('div', { className: 'tvs-metric' },
                    h('span', { className: 'tvs-metric-icon' }, '📏'),
                    h('span', { className: 'tvs-metric-value' }, `${distance} km`)
                ),
                h('div', { className: 'tvs-metric' },
                    h('span', { className: 'tvs-metric-icon' }, '⏱️'),
                    h('span', { className: 'tvs-metric-value' }, duration)
                )
            ),
            rating > 0 && h('div', { className: 'tvs-activity-rating' },
                Array.from({ length: 10 }).map((_, i) =>
                    h('span', {
                        key: i,
                        className: `tvs-star ${i < rating ? 'tvs-star--filled' : ''}`
                    }, '⭐')
                ),
                h('span', { className: 'tvs-rating-value' }, ` ${rating}/10`)
            ),
            showNotes && notes && h('div', { className: 'tvs-activity-notes' },
                h('div', { className: `tvs-notes-content ${expanded ? 'expanded' : 'collapsed'}` },
                    expanded ? notes : (notes.substring(0, 100) + (notes.length > 100 ? '...' : ''))
                ),
                notes.length > 100 && h('button', {
                    className: 'tvs-notes-toggle',
                    onClick: () => setExpanded(!expanded)
                }, expanded ? 'Show less' : 'Read more')
            )
        ),
        h('a', {
            href: activity.permalink || `?p=${activity.id}&post_type=tvs_activity`,
            className: 'tvs-activity-link'
        }, 'View Details →')
    );
}

// Helper functions
function groupByDate(activities) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());
    
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const groups = {};

    activities.forEach(activity => {
        const activityDate = new Date(activity.date);
        activityDate.setHours(0, 0, 0, 0);
        
        let label;
        if (activityDate.getTime() === today.getTime()) {
            label = 'Today';
        } else if (activityDate.getTime() === yesterday.getTime()) {
            label = 'Yesterday';
        } else if (activityDate >= thisWeekStart) {
            label = 'This Week';
        } else if (activityDate >= lastWeekStart) {
            label = 'Last Week';
        } else {
            label = activityDate.toLocaleDateString('no-NO', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }

        if (!groups[label]) {
            groups[label] = { label, activities: [] };
        }
        groups[label].activities.push(activity);
    });

    return Object.values(groups);
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
}

// Mount component
function mountActivityTimeline() {
    const containers = document.querySelectorAll('.tvs-activity-timeline-block');
    
    containers.forEach(container => {
        const userId = parseInt(container.dataset.userId) || 0;
        const limit = parseInt(container.dataset.limit) || 10;
        const title = container.dataset.title || 'Activity Timeline';
        const showNotes = container.dataset.showNotes === '1';
        const showFilters = container.dataset.showFilters === '1';

        const root = window.ReactDOM.createRoot(container);
        root.render(
            h(ActivityTimelineBlock, {
                userId,
                limit,
                title,
                showNotes,
                showFilters
            })
        );
    });
}

// Auto-mount on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountActivityTimeline);
} else {
    mountActivityTimeline();
}
