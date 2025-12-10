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
        h('div', { key: 'header', className: 'tvs-gallery-header' }, [
            h('h2', { key: 'title', className: 'tvs-gallery-title' }, title),
            
            showFilters && h('div', { key: 'filters', className: 'tvs-gallery-filters' }, [
                h('select', {
                    key: 'type-filter',
                    className: 'tvs-filter-select',
                    value: selectedType,
                    onChange: (e) => setSelectedType(e.target.value)
                }, [
                    h('option', { key: 'all', value: 'all' }, 'All Types'),
                    h('option', { key: 'run', value: 'run' }, '🏃 Run'),
                    h('option', { key: 'ride', value: 'ride' }, '🚴 Ride'),
                    h('option', { key: 'walk', value: 'walk' }, '🚶 Walk'),
                    h('option', { key: 'hike', value: 'hike' }, '⛰️ Hike'),
                    h('option', { key: 'swim', value: 'swim' }, '🏊 Swim'),
                    h('option', { key: 'workout', value: 'workout' }, '💪 Workout')
                ]),
                
                h('select', {
                    key: 'period-filter',
                    className: 'tvs-filter-select',
                    value: selectedPeriod,
                    onChange: (e) => setSelectedPeriod(e.target.value)
                }, [
                    h('option', { key: 'all', value: 'all' }, 'All Time'),
                    h('option', { key: '7d', value: '7d' }, 'Last 7 Days'),
                    h('option', { key: '30d', value: '30d' }, 'Last 30 Days'),
                    h('option', { key: '90d', value: '90d' }, 'Last 90 Days')
                ]),
                
                h('select', {
                    key: 'sort-filter',
                    className: 'tvs-filter-select',
                    value: sortBy,
                    onChange: (e) => setSortBy(e.target.value)
                }, [
                    h('option', { key: 'newest', value: 'newest' }, 'Newest First'),
                    h('option', { key: 'oldest', value: 'oldest' }, 'Oldest First'),
                    h('option', { key: 'distance', value: 'distance' }, 'Longest Distance'),
                    h('option', { key: 'rating', value: 'rating' }, 'Best Rating')
                ])
            ])
        ]),

        processedActivities.length === 0 
            ? h('div', { key: 'empty', className: 'tvs-gallery-empty' },
                h('p', null, 'No activities found matching your filters.')
              )
            : h('div', { 
                key: 'grid', 
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

        totalPages > 1 && h('div', { key: 'pagination', className: 'tvs-gallery-pagination' }, [
            h('button', {
                key: 'prev',
                className: 'tvs-pagination-btn',
                disabled: currentPage === 1,
                onClick: () => setCurrentPage(p => p - 1)
            }, '← Previous'),
            h('span', { key: 'info', className: 'tvs-pagination-info' }, 
                `Page ${currentPage} of ${totalPages}`
            ),
            h('button', {
                key: 'next',
                className: 'tvs-pagination-btn',
                disabled: currentPage === totalPages,
                onClick: () => setCurrentPage(p => p + 1)
            }, 'Next →')
        ]),

        modalActivity && h(ActivityModal, {
            key: 'modal',
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

    let source = activity.meta.source;
    if (Array.isArray(source) && source.length > 0) source = source[0];
    source = String(source || 'manual').toLowerCase();

    // Workout-specific metrics
    let exercises = activity.meta._tvs_manual_exercises;
    if (Array.isArray(exercises)) exercises = exercises[0];
    let exerciseCount = 0;
    if (exercises) {
        try {
            const parsed = JSON.parse(exercises);
            if (Array.isArray(parsed)) exerciseCount = parsed.length;
        } catch (e) {}
    }

    const typeConfig = getTypeConfig(activityType);
    const hasRoute = routeId > 0;
    const thumbnail = activity.thumbnail; // Featured image URL from API
    const isWorkout = activityType === 'Workout';
    
    // Build icon path for fallback: icon-{source}-{type}.png
    const iconPath = getIconPath(source, activityType);

    return h('div', {
        className: `tvs-gallery-card tvs-gallery-card--${typeConfig.className}`,
        onClick,
        style: {
            background: 'var(--tvs-glass-bg)',
            backdropFilter: 'blur(var(--tvs-glass-blur))',
            border: '1px solid var(--tvs-glass-border)',
            borderRadius: 'var(--tvs-radius-lg)',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
        }
    }, [
        h('div', { 
            key: 'image',
            className: 'tvs-gallery-card-image',
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }
        },
            thumbnail
                ? h('img', { 
                    className: 'tvs-gallery-card-thumbnail',
                    src: thumbnail,
                    alt: activity.title || 'Activity',
                    loading: 'lazy',
                    style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center'
                    }
                  })
                : h('img', { 
                    className: 'tvs-gallery-card-icon-img',
                    src: iconPath,
                    alt: `${typeConfig.label} icon`,
                    loading: 'lazy',
                    style: {
                        maxWidth: '60%',
                        maxHeight: '60%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain'
                    }
                  })
        ),
        
        h('div', { key: 'overlay', className: 'tvs-gallery-card-overlay' }, [
            h('div', { key: 'badge', className: 'tvs-gallery-card-badge' },
                h('span', null, typeConfig.label)
            ),
            
            rating > 0 && h('div', { key: 'rating', className: 'tvs-gallery-card-rating' },
                Array.from({ length: 10 }).map((_, i) =>
                    h('span', {
                        key: i,
                        className: `tvs-star ${i < rating ? 'tvs-star--filled' : ''}`
                    }, '★')
                )
            )
        ]),
        
        h('div', { key: 'info', className: 'tvs-gallery-card-info' }, [
            h('div', { key: 'metrics', className: 'tvs-gallery-card-metrics' }, isWorkout ? [
                exerciseCount > 0 && h('span', { key: 'exercises', className: 'tvs-metric' }, `${exerciseCount} exercises`),
                h('span', { key: 'duration', className: 'tvs-metric' }, formatDuration(duration))
            ].filter(Boolean) : [
                h('span', { key: 'distance', className: 'tvs-metric' }, `${(distance / 1000).toFixed(2)} km`),
                h('span', { key: 'duration', className: 'tvs-metric' }, formatDuration(duration))
            ]),
            h('div', { key: 'date', className: 'tvs-gallery-card-date' },
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

    let source = activity.meta.source;
    if (Array.isArray(source)) source = source[0];
    source = String(source || 'manual').toLowerCase();

    // Workout-specific metrics
    let exercises = activity.meta._tvs_manual_exercises;
    if (Array.isArray(exercises)) exercises = exercises[0];
    let exerciseCount = 0;
    if (exercises) {
        try {
            const parsed = JSON.parse(exercises);
            if (Array.isArray(parsed)) exerciseCount = parsed.length;
        } catch (e) {}
    }

    let sets = activity.meta._tvs_manual_sets;
    if (Array.isArray(sets)) sets = sets[0];
    sets = parseInt(sets) || 0;

    let reps = activity.meta._tvs_manual_reps;
    if (Array.isArray(reps)) reps = reps[0];
    reps = parseInt(reps) || 0;

    const typeConfig = getTypeConfig(activityType);
    const iconPath = getIconPath(source, activityType);
    const isWorkout = activityType === 'Workout';

    return h('div', {
        className: 'tvs-gallery-modal-overlay',
        onClick: onClose,
        style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--tvs-color-overlay-heavy)',
            backdropFilter: 'blur(var(--tvs-blur-lg))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--tvs-z-modal)',
            padding: 'var(--tvs-space-4)'
        }
    }, [
        h('div', {
            className: 'tvs-gallery-modal',
            onClick: (e) => e.stopPropagation(),
            style: {
                background: 'var(--tvs-glass-bg)',
                backdropFilter: 'blur(var(--tvs-glass-blur))',
                border: '1px solid var(--tvs-glass-border)',
                borderRadius: 'var(--tvs-radius-xl)',
                padding: 'var(--tvs-space-8)',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: 'var(--tvs-shadow-2xl)',
                position: 'relative'
            }
        }, [
            h('button', {
                className: 'tvs-modal-close',
                onClick: onClose,
                style: {
                    position: 'absolute',
                    top: 'var(--tvs-space-4)',
                    right: 'var(--tvs-space-4)',
                    zIndex: 10,
                    background: 'transparent',
                    border: 'none',
                    fontSize: '28px',
                    color: 'var(--tvs-color-text-primary)',
                    cursor: 'pointer',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--tvs-radius-md)',
                    transition: 'background 0.2s ease'
                }
            }, '×'),
            
            h('div', { 
                className: 'tvs-modal-header',
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--tvs-space-3)',
                    marginBottom: 'var(--tvs-space-6)'
                }
            }, [
                h('img', { 
                    src: iconPath,
                    alt: typeConfig.label,
                    className: 'tvs-modal-icon',
                    style: {
                        width: '40px',
                        height: '40px',
                        objectFit: 'contain'
                    }
                }),
                h('h3', { 
                    style: { 
                        flex: 1,
                        margin: 0,
                        fontSize: 'var(--tvs-text-xl)',
                        fontWeight: 'var(--tvs-font-semibold)'
                    }
                }, activity.title),
                h('span', { 
                    className: 'tvs-modal-type',
                    style: {
                        padding: 'var(--tvs-badge-padding-y) var(--tvs-badge-padding-x)',
                        fontSize: 'var(--tvs-badge-font-size)',
                        fontWeight: 'var(--tvs-badge-font-weight)',
                        borderRadius: 'var(--tvs-badge-radius)',
                        background: 'var(--tvs-color-surface-raised)',
                        color: 'var(--tvs-color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }
                }, typeConfig.label)
            ]),
            
            h('div', { 
                className: 'tvs-modal-metrics',
                style: {
                    display: 'grid',
                    gridTemplateColumns: isWorkout ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                    gap: 'var(--tvs-space-4)',
                    marginBottom: 'var(--tvs-space-6)'
                }
            }, isWorkout ? [
                // Workout metrics: Duration, Exercises, Sets, Reps
                h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Duration'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, formatDuration(duration))
                ]),
                exerciseCount > 0 && h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Exercises'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, exerciseCount)
                ]),
                sets > 0 && h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Sets'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, sets)
                ]),
                reps > 0 && h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Reps'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, reps)
                ]),
                rating > 0 && h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Rating'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, `${rating}/10 ★`)
                ])
            ].filter(Boolean) : [
                // Non-workout metrics: Distance, Duration, Pace, Rating
                h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Distance'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, `${(distance / 1000).toFixed(2)} km`)
                ]),
                h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Duration'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, formatDuration(duration))
                ]),
                h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Pace'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, duration && distance ? `${(duration / 60 / (distance / 1000)).toFixed(2)} min/km` : 'N/A')
                ]),
                rating > 0 && h('div', { 
                    className: 'tvs-modal-metric',
                    style: {
                        background: 'var(--tvs-color-surface-raised)',
                        padding: 'var(--tvs-space-4)',
                        borderRadius: 'var(--tvs-radius-lg)',
                        textAlign: 'center'
                    }
                }, [
                    h('span', { 
                        className: 'tvs-modal-metric-label',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-xs)',
                            color: 'var(--tvs-color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--tvs-space-2)'
                        }
                    }, 'Rating'),
                    h('span', { 
                        className: 'tvs-modal-metric-value',
                        style: {
                            display: 'block',
                            fontSize: 'var(--tvs-text-2xl)',
                            fontWeight: 'var(--tvs-font-bold)',
                            color: 'var(--tvs-color-text-primary)'
                        }
                    }, `${rating}/10 ★`)
                ])
            ].filter(Boolean)),
            
            notes && h('div', { className: 'tvs-modal-notes' }, [
                h('h4', null, 'Notes'),
                h('p', null, notes)
            ]),
            
            h('div', { className: 'tvs-modal-footer' }, [
                h('a', {
                    href: activity.permalink,
                    className: 'tvs-modal-btn tvs-modal-btn--primary',
                    style: {
                        display: 'inline-block',
                        padding: 'var(--tvs-button-padding-y) var(--tvs-button-padding-x)',
                        fontSize: 'var(--tvs-button-font-size)',
                        fontWeight: 'var(--tvs-button-font-weight)',
                        borderRadius: 'var(--tvs-button-radius)',
                        background: 'var(--tvs-color-primary)',
                        color: 'var(--tvs-color-text-on-primary)',
                        textDecoration: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                    }
                }, 'View Full Details'),
                h('button', {
                    className: 'tvs-modal-btn',
                    onClick: onClose,
                    style: {
                        padding: 'var(--tvs-button-padding-y) var(--tvs-button-padding-x)',
                        fontSize: 'var(--tvs-button-font-size)',
                        fontWeight: 'var(--tvs-button-font-weight)',
                        borderRadius: 'var(--tvs-button-radius)',
                        background: 'var(--tvs-color-surface-raised)',
                        color: 'var(--tvs-color-text-primary)',
                        border: '1px solid var(--tvs-color-border-default)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }
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

function getIconPath(source, activityType) {
    // Normalize activity type to lowercase for filename matching
    const typeMap = {
        'Run': 'run',
        'Ride': 'ride', 
        'Walk': 'walk',
        'Hike': 'hike',
        'Swim': 'swim',
        'Workout': 'workout'
    };
    
    const type = typeMap[activityType] || 'workout';
    const sourceNormalized = source.toLowerCase(); // manual, virtual, or video
    
    // Get theme URL from TVS_SETTINGS (localized in PHP)
    const themeUrl = window.TVS_SETTINGS?.themeUrl || '/wp-content/themes/tvs-theme';
    
    // Build path: icon-{source}-{type}.png
    return `${themeUrl}/assets/icons/icon-${sourceNormalized}-${type}.png`;
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
