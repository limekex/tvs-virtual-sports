/**
 * Activity Gallery Block - Frontend View
 * 
 * Visual grid gallery of activities with route map thumbnails and filters
 */

const { createElement: h, useState, useEffect } = window.React;

function ActivityGalleryBlock({ userId, limit, title, layout, columns, showFilters }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedType, setSelectedType] = useState('all');
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [modalActivity, setModalActivity] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    useEffect(() => {
        fetchActivities();
    }, [currentPage]);

    const fetchActivities = async () => {
        setLoading(true);
        setError(null);

        try {
            const url = `${window.TVS_SETTINGS.restRoot}tvs/v1/activities/me?per_page=${limit}&page=${currentPage}`;
            const response = await fetch(url, {
                headers: { 'X-WP-Nonce': window.TVS_SETTINGS.nonce }
            });

            if (!response.ok) throw new Error('Failed to fetch activities');

            const data = await response.json();
            const total = parseInt(response.headers.get('X-WP-Total') || '0');
            const pages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
            
            setActivities(data || []);
            setTotalPages(pages);
        } catch (err) {
            console.error('Error fetching activities:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter and sort activities
    const processedActivities = activities
        .filter(a => {
            // Type filter
            if (selectedType !== 'all') {
                let actType = a.meta.activity_type;
                if (Array.isArray(actType) && actType.length > 0) actType = actType[0];
                if (typeof actType !== 'string') actType = 'workout';
                if (actType.toLowerCase() !== selectedType.toLowerCase()) return false;
            }

            // Period filter
            if (selectedPeriod !== 'all') {
                const activityDate = new Date(a.date);
                const now = new Date();
                const daysDiff = Math.floor((now - activityDate) / (1000 * 60 * 60 * 24));
                
                if (selectedPeriod === '7d' && daysDiff > 7) return false;
                if (selectedPeriod === '30d' && daysDiff > 30) return false;
                if (selectedPeriod === '90d' && daysDiff > 90) return false;
            }

            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.date) - new Date(a.date);
            if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
            if (sortBy === 'distance') {
                const distA = parseFloat(Array.isArray(a.meta.distance_m) ? a.meta.distance_m[0] : a.meta.distance_m) || 0;
                const distB = parseFloat(Array.isArray(b.meta.distance_m) ? b.meta.distance_m[0] : b.meta.distance_m) || 0;
                return distB - distA;
            }
            if (sortBy === 'rating') {
                const ratingA = parseInt(Array.isArray(a.meta.rating) ? a.meta.rating[0] : a.meta.rating) || 0;
                const ratingB = parseInt(Array.isArray(b.meta.rating) ? b.meta.rating[0] : b.meta.rating) || 0;
                return ratingB - ratingA;
            }
            return 0;
        });

    if (loading) {
        return h('div', { className: 'tvs-gallery-loading' },
            h('div', { className: 'tvs-loading-spinner' })
        );
    }

    if (error) {
        return h('div', { className: 'tvs-gallery-error' },
            h('p', null, `Error: ${error}`)
        );
    }

    return h('div', { className: 'tvs-activity-gallery' }, [
        h('div', { className: 'tvs-gallery-header' }, [
            h('h2', { className: 'tvs-gallery-title' }, title),
            
            showFilters && h('div', { className: 'tvs-gallery-filters' }, [
                h('select', {
                    className: 'tvs-filter-select',
                    value: selectedType,
                    onChange: (e) => setSelectedType(e.target.value)
                }, [
                    h('option', { value: 'all' }, 'All Types'),
                    h('option', { value: 'run' }, '🏃 Run'),
                    h('option', { value: 'ride' }, '🚴 Ride'),
                    h('option', { value: 'walk' }, '🚶 Walk'),
                    h('option', { value: 'hike' }, '⛰️ Hike'),
                    h('option', { value: 'swim' }, '🏊 Swim'),
                    h('option', { value: 'workout' }, '💪 Workout')
                ]),
                
                h('select', {
                    className: 'tvs-filter-select',
                    value: selectedPeriod,
                    onChange: (e) => setSelectedPeriod(e.target.value)
                }, [
                    h('option', { value: 'all' }, 'All Time'),
                    h('option', { value: '7d' }, 'Last 7 Days'),
                    h('option', { value: '30d' }, 'Last 30 Days'),
                    h('option', { value: '90d' }, 'Last 90 Days')
                ]),
                
                h('select', {
                    className: 'tvs-filter-select',
                    value: sortBy,
                    onChange: (e) => setSortBy(e.target.value)
                }, [
                    h('option', { value: 'newest' }, 'Newest First'),
                    h('option', { value: 'oldest' }, 'Oldest First'),
                    h('option', { value: 'distance' }, 'Longest Distance'),
                    h('option', { value: 'rating' }, 'Best Rating')
                ])
            ])
        ]),

        processedActivities.length === 0 
            ? h('div', { className: 'tvs-gallery-empty' },
                h('p', null, 'No activities found matching your filters.')
              )
            : h('div', { 
                className: `tvs-gallery-grid tvs-gallery-grid--${layout} tvs-gallery-grid--cols-${columns}` 
              },
                processedActivities.map(activity =>
                    h(GalleryCard, {
                        key: activity.id,
                        activity,
                        onClick: () => setModalActivity(activity)
                    })
                )
              ),

        totalPages > 1 && h('div', { className: 'tvs-gallery-pagination' }, [
            h('button', {
                className: 'tvs-pagination-btn',
                disabled: currentPage === 1,
                onClick: () => setCurrentPage(p => p - 1)
            }, '← Previous'),
            h('span', { className: 'tvs-pagination-info' }, 
                `Page ${currentPage} of ${totalPages}`
            ),
            h('button', {
                className: 'tvs-pagination-btn',
                disabled: currentPage === totalPages,
                onClick: () => setCurrentPage(p => p + 1)
            }, 'Next →')
        ]),

        modalActivity && h(ActivityModal, {
            activity: modalActivity,
            onClose: () => setModalActivity(null)
        })
    ]);
}

// Gallery Card Component
function GalleryCard({ activity, onClick }) {
    let activityType = activity.meta.activity_type;
    if (Array.isArray(activityType) && activityType.length > 0) {
        activityType = activityType[0];
    }
    if (typeof activityType !== 'string') activityType = 'Workout';

    let routeId = activity.meta.route_id;
    if (Array.isArray(routeId) && routeId.length > 0) routeId = routeId[0];
    routeId = parseInt(routeId) || 0;

    let distance = activity.meta.distance_m;
    if (Array.isArray(distance) && distance.length > 0) distance = distance[0];
    distance = parseFloat(distance) || 0;

    let duration = activity.meta.duration_s;
    if (Array.isArray(duration) && duration.length > 0) duration = duration[0];
    duration = parseInt(duration) || 0;

    let rating = activity.meta.rating;
    if (Array.isArray(rating) && rating.length > 0) rating = rating[0];
    rating = parseInt(rating) || 0;

    const typeConfig = getTypeConfig(activityType);
    const hasRoute = routeId > 0;

    return h('div', {
        className: `tvs-gallery-card tvs-gallery-card--${typeConfig.className}`,
        onClick
    }, [
        h('div', { className: 'tvs-gallery-card-image' },
            hasRoute
                ? h('div', { className: 'tvs-gallery-card-map' },
                    h('div', { className: 'tvs-map-placeholder' }, '🗺️')
                  )
                : h('div', { className: 'tvs-gallery-card-icon' },
                    h('span', { className: 'tvs-activity-icon' }, typeConfig.icon)
                  )
        ),
        
        h('div', { className: 'tvs-gallery-card-overlay' }, [
            h('div', { className: 'tvs-gallery-card-badge' },
                h('span', null, typeConfig.label)
            ),
            
            rating > 0 && h('div', { className: 'tvs-gallery-card-rating' },
                Array.from({ length: 10 }).map((_, i) =>
                    h('span', {
                        key: i,
                        className: `tvs-star ${i < rating ? 'tvs-star--filled' : ''}`
                    }, '★')
                )
            )
        ]),
        
        h('div', { className: 'tvs-gallery-card-info' }, [
            h('div', { className: 'tvs-gallery-card-metrics' }, [
                h('span', { className: 'tvs-metric' }, `${(distance / 1000).toFixed(2)} km`),
                h('span', { className: 'tvs-metric' }, formatDuration(duration))
            ]),
            h('div', { className: 'tvs-gallery-card-date' },
                formatDate(activity.date)
            )
        ])
    ]);
}

// Activity Modal Component
function ActivityModal({ activity, onClose }) {
    let activityType = activity.meta.activity_type;
    if (Array.isArray(activityType)) activityType = activityType[0];

    let distance = activity.meta.distance_m;
    if (Array.isArray(distance)) distance = distance[0];
    distance = parseFloat(distance) || 0;

    let duration = activity.meta.duration_s;
    if (Array.isArray(duration)) duration = duration[0];
    duration = parseInt(duration) || 0;

    let rating = activity.meta.rating;
    if (Array.isArray(rating)) rating = rating[0];
    rating = parseInt(rating) || 0;

    let notes = activity.meta.notes;
    if (Array.isArray(notes)) notes = notes[0];
    notes = String(notes || '');

    const typeConfig = getTypeConfig(activityType);

    return h('div', {
        className: 'tvs-gallery-modal-overlay',
        onClick: onClose
    }, [
        h('div', {
            className: 'tvs-gallery-modal',
            onClick: (e) => e.stopPropagation()
        }, [
            h('button', {
                className: 'tvs-modal-close',
                onClick: onClose
            }, '×'),
            
            h('div', { className: 'tvs-modal-header' }, [
                h('span', { className: 'tvs-modal-icon' }, typeConfig.icon),
                h('h3', null, activity.title),
                h('span', { className: 'tvs-modal-type' }, typeConfig.label)
            ]),
            
            h('div', { className: 'tvs-modal-metrics' }, [
                h('div', { className: 'tvs-modal-metric' }, [
                    h('span', { className: 'tvs-modal-metric-label' }, 'Distance'),
                    h('span', { className: 'tvs-modal-metric-value' }, `${(distance / 1000).toFixed(2)} km`)
                ]),
                h('div', { className: 'tvs-modal-metric' }, [
                    h('span', { className: 'tvs-modal-metric-label' }, 'Duration'),
                    h('span', { className: 'tvs-modal-metric-value' }, formatDuration(duration))
                ]),
                h('div', { className: 'tvs-modal-metric' }, [
                    h('span', { className: 'tvs-modal-metric-label' }, 'Pace'),
                    h('span', { className: 'tvs-modal-metric-value' }, 
                        duration && distance ? `${(duration / 60 / (distance / 1000)).toFixed(2)} min/km` : 'N/A'
                    )
                ]),
                rating > 0 && h('div', { className: 'tvs-modal-metric' }, [
                    h('span', { className: 'tvs-modal-metric-label' }, 'Rating'),
                    h('span', { className: 'tvs-modal-metric-value' }, `${rating}/10 ★`)
                ])
            ]),
            
            notes && h('div', { className: 'tvs-modal-notes' }, [
                h('h4', null, 'Notes'),
                h('p', null, notes)
            ]),
            
            h('div', { className: 'tvs-modal-footer' }, [
                h('a', {
                    href: activity.permalink,
                    className: 'tvs-modal-btn tvs-modal-btn--primary'
                }, 'View Full Details'),
                h('button', {
                    className: 'tvs-modal-btn',
                    onClick: onClose
                }, 'Close')
            ])
        ])
    ]);
}

// Utility functions
function getTypeConfig(type) {
    const configs = {
        'Run': { icon: '🏃', label: 'Run', className: 'run', color: '#3b82f6' },
        'Ride': { icon: '🚴', label: 'Ride', className: 'ride', color: '#10b981' },
        'Walk': { icon: '🚶', label: 'Walk', className: 'walk', color: '#f59e0b' },
        'Hike': { icon: '⛰️', label: 'Hike', className: 'hike', color: '#f97316' },
        'Swim': { icon: '🏊', label: 'Swim', className: 'swim', color: '#06b6d4' },
        'Workout': { icon: '💪', label: 'Workout', className: 'workout', color: '#a855f7' }
    };
    return configs[type] || configs['Workout'];
}

function formatDuration(seconds) {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Mount the block
document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('.tvs-activity-gallery-block');
    containers.forEach(container => {
        const props = {
            userId: parseInt(container.dataset.userId) || 0,
            limit: parseInt(container.dataset.limit) || 12,
            title: container.dataset.title || 'Activity Gallery',
            layout: container.dataset.layout || 'grid',
            columns: parseInt(container.dataset.columns) || 3,
            showFilters: container.dataset.showFilters === '1'
        };

        const root = window.ReactDOM.createRoot(container);
        root.render(h(ActivityGalleryBlock, props));
    });
});
