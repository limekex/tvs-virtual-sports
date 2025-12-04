/**
 * Activity Stats Dashboard Block - Frontend View
 * 
 * Displays comprehensive activity statistics with optional charts
 */

const { createElement: h, useState, useEffect } = window.React;

function StatCard({ label, value, unit, icon }) {
    return h('div', { className: 'tvs-stat-card' },
        icon && h('div', { className: 'tvs-stat-card__icon' }, icon),
        h('div', { className: 'tvs-stat-card__content' },
            h('div', { className: 'tvs-stat-card__label' }, label),
            h('div', { className: 'tvs-stat-card__value' },
                value,
                unit && h('span', { className: 'tvs-stat-card__unit' }, ` ${unit}`)
            )
        )
    );
}

function TypeBreakdown({ data }) {
    if (!data || !data.length) {
        return null;
    }

    const total = data.reduce((sum, item) => sum + item.count, 0);

    return h('div', { className: 'tvs-type-breakdown' },
        h('h4', { className: 'tvs-type-breakdown__title' }, 'Activity Types'),
        h('div', { className: 'tvs-type-breakdown__list' },
            data.map((item, idx) => {
                const percentage = Math.round((item.count / total) * 100);
                return h('div', { key: idx, className: 'tvs-type-breakdown__item' },
                    h('div', { className: 'tvs-type-breakdown__bar-wrapper' },
                        h('div', { 
                            className: 'tvs-type-breakdown__bar',
                            style: { width: `${percentage}%` }
                        })
                    ),
                    h('div', { className: 'tvs-type-breakdown__label' },
                        h('span', { className: 'tvs-type-breakdown__name' }, item.name || 'Unknown'),
                        h('span', { className: 'tvs-type-breakdown__count' }, `${item.count} (${percentage}%)`)
                    )
                );
            })
        )
    );
}

function PeriodSelector({ current, onChange }) {
    const periods = [
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
        { value: '90d', label: '90 Days' },
        { value: 'all', label: 'All Time' }
    ];

    return h('div', { className: 'tvs-period-selector' },
        periods.map(period =>
            h('button', {
                key: period.value,
                className: `tvs-period-selector__button ${current === period.value ? 'tvs-period-selector__button--active' : ''}`,
                onClick: () => onChange(period.value)
            }, period.label)
        )
    );
}

function ActivityStatsDashboard({ userId, initialPeriod, title, showCharts }) {
    const [stats, setStats] = useState(null);
    const [period, setPeriod] = useState(initialPeriod);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchStats();
    }, [period, userId]);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);

        try {
            const url = `${window.TVS_SETTINGS.restRoot}tvs/v1/activities/stats?user_id=${userId}&period=${period}`;
            const response = await fetch(url, {
                headers: {
                    'X-WP-Nonce': window.TVS_SETTINGS.nonce
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch statistics');
            }

            const data = await response.json();
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return h('div', { className: 'tvs-stats-dashboard tvs-stats-dashboard--loading' },
            h('div', { className: 'tvs-loading-spinner' })
        );
    }

    if (error) {
        return h('div', { className: 'tvs-stats-dashboard tvs-stats-dashboard--error' },
            h('p', { className: 'tvs-error-message' }, error)
        );
    }

    if (!stats || stats.total_activities === 0) {
        return h('div', { className: 'tvs-stats-dashboard tvs-stats-dashboard--empty' },
            h('p', { className: 'tvs-empty-message' }, 'No activities found for this period.')
        );
    }

    // Format distance (meters to km)
    const distanceKm = (stats.total_distance_m / 1000).toFixed(1);
    
    // Format duration (seconds to hours:minutes)
    const hours = Math.floor(stats.total_duration_s / 3600);
    const minutes = Math.floor((stats.total_duration_s % 3600) / 60);
    const durationFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    // Format average rating
    const avgRating = stats.avg_rating ? stats.avg_rating.toFixed(1) : 'N/A';

    return h('div', { className: 'tvs-stats-dashboard' },
        h('div', { className: 'tvs-stats-dashboard__header' },
            h('h3', { className: 'tvs-stats-dashboard__title' }, title),
            h(PeriodSelector, { current: period, onChange: setPeriod })
        ),
        
        h('div', { className: 'tvs-stats-dashboard__summary' },
            h(StatCard, { 
                label: 'Total Activities', 
                value: stats.total_activities,
                icon: '🏃'
            }),
            h(StatCard, { 
                label: 'Total Distance', 
                value: distanceKm, 
                unit: 'km',
                icon: '📏'
            }),
            h(StatCard, { 
                label: 'Total Time', 
                value: durationFormatted,
                icon: '⏱️'
            }),
            h(StatCard, { 
                label: 'Average Rating', 
                value: avgRating,
                icon: '⭐'
            })
        ),

        showCharts && stats.activity_type_counts && stats.activity_type_counts.length > 0 &&
            h('div', { className: 'tvs-stats-dashboard__charts' },
                h(TypeBreakdown, { data: stats.activity_type_counts })
            )
    );
}

// Mount component when DOM is ready
function mountDashboard() {
    const containers = document.querySelectorAll('.tvs-stats-dashboard-block');
    
    containers.forEach(container => {
        const userId = parseInt(container.dataset.userId) || 0;
        const period = container.dataset.period || '30d';
        const title = container.dataset.title || 'Activity Dashboard';
        const showCharts = container.dataset.showCharts === '1';

        const root = window.ReactDOM.createRoot(container);
        root.render(
            h(ActivityStatsDashboard, {
                userId,
                initialPeriod: period,
                title,
                showCharts
            })
        );
    });
}

// Auto-mount on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDashboard);
} else {
    mountDashboard();
}
