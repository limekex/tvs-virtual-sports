/**
 * Activity Comparison Block - Frontend View
 * Interactive comparison of two activities with search and mode switching
 */

const { createElement: h, useState, useEffect, useRef } = window.React;
const { createRoot } = window.ReactDOM;

// Activity types supported
const ACTIVITY_TYPES = ['Run', 'Ride', 'Walk', 'Hike', 'Swim', 'Workout'];

// Helper to decode HTML entities (global scope)
const decodeHTML = (html) => {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

// Activity search component with AJAX dropdown
const ActivitySearchDropdown = ({ onSelect, userId, activityType, excludeId, placeholder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => searchActivities(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activityType, userId]);

  const searchActivities = async (term) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${TVS_SETTINGS.restRoot}tvs/v1/activities/user/${userId}?per_page=50`,
        { headers: { 'X-WP-Nonce': TVS_SETTINGS.nonce } }
      );
      
      if (!response.ok) {
        throw new Error('Failed to search activities');
      }
      const data = await response.json();
      
      // Helper to decode HTML entities
      const decodeHTML = (html) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
      };
      
      // Filter by activity type and search term with relevance scoring
      const filtered = (data.activities || []).filter(a => {
        const matchesType = !activityType || a.activity_type === activityType;
        const decodedTitle = decodeHTML(a.title || '');
        const titleLower = decodedTitle.toLowerCase();
        const activityTypeLower = (a.activity_type || '').toLowerCase();
        const searchLower = term.toLowerCase();
        
        // Check if the entire search phrase matches first (highest relevance)
        const exactMatch = titleLower.includes(searchLower) || activityTypeLower.includes(searchLower);
        
        // Split search terms by space and count matches
        const searchTerms = searchLower.split(/\s+/).filter(t => t.length > 0);
        let matchCount = 0;
        searchTerms.forEach(searchTerm => {
          if (titleLower.includes(searchTerm)) matchCount++;
          if (activityTypeLower.includes(searchTerm)) matchCount++;
        });
        
        // Store match count for sorting
        a._relevance = exactMatch ? 1000 + matchCount : matchCount;
        
        const matchesTerm = matchCount > 0;
        const notExcluded = !excludeId || a.id !== excludeId;
        const hasDuration = a.duration_s > 0;
        
        return matchesType && matchesTerm && notExcluded && hasDuration;
      });
      
      // Sort by relevance first, then by date descending (newest first)
      filtered.sort((a, b) => {
        if (b._relevance !== a._relevance) {
          return b._relevance - a._relevance; // Higher relevance first
        }
        return new Date(b.date) - new Date(a.date); // Then newest first
      });
      
      setResults(filtered);
      setIsOpen(filtered.length > 0);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (activity) => {
    onSelect(activity);
    // Decode HTML entities for display
    setSearchTerm(decodeHTML(activity.title));
    setIsOpen(false);
  };

  return h('div', { className: 'tvs-activity-search', ref: searchRef }, [
    h('input', {
      key: 'search-input',
      type: 'text',
      className: 'tvs-activity-search__input',
      placeholder: placeholder || 'Search activities...',
      value: searchTerm,
      onChange: (e) => setSearchTerm(e.target.value),
      onFocus: () => results.length > 0 && setIsOpen(true),
    }),
    loading && h('span', { key: 'loading', className: 'tvs-activity-search__loading' }, '🔍'),
    isOpen && results.length > 0 && h('ul', { key: 'results-list', className: 'tvs-activity-search__results' },
      results.map(activity => 
        h('li', {
          key: activity.id,
          className: 'tvs-activity-search__result',
          onClick: () => handleSelect(activity),
        }, [
          h('div', { key: 'title', className: 'tvs-activity-search__result-title' }, decodeHTML(activity.title)),
          h('div', { key: 'meta', className: 'tvs-activity-search__result-meta' }, 
            `${activity.activity_type} • ${new Date(activity.date).toLocaleDateString()} • ${formatDuration(activity.duration_s)}`
          ),
        ])
      )
    ),
  ]);
};

// Mode switch component
const ModeSwitch = ({ currentMode, onChange }) => {
  return h('div', { className: 'tvs-mode-switch' }, [
    h('button', {
      key: 'manual',
      className: `tvs-mode-switch__btn ${currentMode === 'manual' ? 'tvs-mode-switch__btn--active' : ''}`,
      onClick: () => onChange('manual'),
    }, '⚙️ Manual'),
    h('button', {
      key: 'vs-best',
      className: `tvs-mode-switch__btn ${currentMode === 'vs-best' ? 'tvs-mode-switch__btn--active' : ''}`,
      onClick: () => onChange('vs-best'),
    }, '🏆 Latest vs Best'),
  ]);
};

// Main component
const ActivityComparison = ({ userId, mode: initialMode, activityId1, activityId2, routeId, title }) => {
  const [mode, setMode] = useState(initialMode || 'vs-best');
  const [activity1, setActivity1] = useState(null);
  const [activity2, setActivity2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedActivity1, setSelectedActivity1] = useState(null);
  const [selectedActivity2, setSelectedActivity2] = useState(null);
  const [selectedActivityType, setSelectedActivityType] = useState('all');
  const [availableTypes, setAvailableTypes] = useState([]);

  // Route context: show vs-previous automatically
  const isRouteContext = !!routeId;

  useEffect(() => {
    if (mode === 'manual') {
      if (selectedActivity1 && selectedActivity2) {
        setActivity1(selectedActivity1);
        setActivity2(selectedActivity2);
        setError(null);
      } else {
        setActivity1(null);
        setActivity2(null);
      }
    } else {
      fetchActivities();
    }
  }, [mode, selectedActivity1, selectedActivity2, routeId, userId, selectedActivityType]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (isRouteContext) {
        await fetchVsPreviousMode();
      } else if (mode === 'vs-best') {
        await fetchVsBestMode();
      }
    } catch (err) {
      setError(err.message);
      setActivity1(null);
      setActivity2(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchVsBestMode = async () => {
    // Fetch all activities to get available types and find best
    const allResponse = await fetch(
      `${TVS_SETTINGS.restRoot}tvs/v1/activities/user/${userId}?per_page=100`,
      { headers: { 'X-WP-Nonce': TVS_SETTINGS.nonce } }
    );
    
    if (!allResponse.ok) throw new Error('Failed to fetch activities');
    const allData = await allResponse.json();
    let allActivities = (allData.activities || []).filter(a => a.duration_s > 0);

    if (allActivities.length === 0) throw new Error('No activities found');

    // Get unique activity types
    const types = [...new Set(allActivities.map(a => a.activity_type))].sort();
    setAvailableTypes(types);

    // Filter by selected type (if not 'all')
    if (selectedActivityType !== 'all') {
      allActivities = allActivities.filter(a => a.activity_type === selectedActivityType);
      if (allActivities.length === 0) {
        throw new Error(`No ${selectedActivityType} activities found`);
      }
    }

    // Get latest activity of selected type (create new sorted array to avoid mutation)
    const sortedByDate = [...allActivities].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sortedByDate[0];

    // Filter: same activity type, exclude latest itself
    let comparableActivities = allActivities.filter(a => 
      a.activity_type === latest.activity_type &&
      a.id !== latest.id // Exclude the latest activity itself
    );

    // Only filter by route if latest has a route AND we want route-specific comparison
    // For vs-best mode without route context, we want ALL activities of same type
    if (latest.route_id && isRouteContext) {
      comparableActivities = comparableActivities.filter(a => a.route_id === latest.route_id);
    }

    // Find personal best based on activity type
    let best;
    if (latest.activity_type === 'Workout') {
      // Workout: longest duration is best
      const sortedByDuration = [...comparableActivities].sort((a, b) => b.duration_s - a.duration_s);
      best = sortedByDuration[0];
    } else if (latest.activity_type === 'Swim') {
      // Swim: fastest pace per lap is best (lowest seconds per lap)
      const withPace = comparableActivities.filter(a => a.laps > 0);
      const sortedByPace = [...withPace].sort((a, b) => {
        const paceA = a.duration_s / a.laps;
        const paceB = b.duration_s / b.laps;
        return paceA - paceB; // Lower pace = faster
      });
      best = sortedByPace[0];
    } else {
      // Run/Ride/Walk/Hike: fastest average speed is best
      const withDistance = comparableActivities.filter(a => a.distance_m > 0 && a.duration_s > 0);
      const sortedBySpeed = [...withDistance].sort((a, b) => {
        const speedA = (a.distance_m / 1000) / (a.duration_s / 3600); // km/h
        const speedB = (b.distance_m / 1000) / (b.duration_s / 3600);
        return speedB - speedA; // Higher speed = better
      });
      best = sortedBySpeed[0];
    }

    if (!best) {
      // This is the only activity or the best one
      setActivity1(latest);
      setActivity2(latest);
      setError('🏆 This is your best (or only) activity of this type!');
      return;
    }

    setActivity1(latest);
    setActivity2(best);
  };

  const fetchVsPreviousMode = async () => {
    if (!routeId) throw new Error('Route ID required');

    // Fetch all activities on this route
    const response = await fetch(
      `${TVS_SETTINGS.restRoot}tvs/v1/activities/user/${userId}?route_id=${routeId}&per_page=50`,
      { headers: { 'X-WP-Nonce': TVS_SETTINGS.nonce } }
    );
    
    if (!response.ok) throw new Error('Failed to fetch route activities');
    const data = await response.json();
    let activities = (data.activities || []).filter(a => a.duration_s > 0);

    if (activities.length === 0) {
      throw new Error('No activities on this route yet');
    }

    // Get latest activity (most recent date)
    const sortedByDate = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sortedByDate[0];

    if (activities.length < 2) {
      setActivity1(latest);
      setActivity2(latest);
      setError('🏆 This is your only activity on this route!');
      return;
    }

    // Find best (fastest) activity on this route, excluding latest
    const comparableActivities = activities.filter(a => a.id !== latest.id);
    
    // For this route: fastest average speed is best
    const withDistance = comparableActivities.filter(a => a.distance_m > 0 && a.duration_s > 0);
    
    const sortedBySpeed = [...withDistance].sort((a, b) => {
      const speedA = (a.distance_m / 1000) / (a.duration_s / 3600); // km/h
      const speedB = (b.distance_m / 1000) / (b.duration_s / 3600);
      return speedB - speedA; // Higher speed = better
    });
    const best = sortedBySpeed[0];

    if (!best) {
      setActivity1(latest);
      setActivity2(latest);
      setError('🏆 This is your best activity on this route!');
      return;
    }

    setActivity1(latest);
    setActivity2(best);
  };

  // Render
  if (loading) {
    return h('div', { className: 'tvs-loading' },
      h('div', { className: 'tvs-spinner' }),
      h('p', null, 'Loading comparison...')
    );
  }

  return h('div', { className: 'tvs-comparison' }, [
    h('h2', { key: 'title', className: 'tvs-comparison__title' }, title || 'Activity Comparison'),
    
    // Mode switch (only if not in route context)
    !isRouteContext && h(ModeSwitch, {
      key: 'mode-switch',
      currentMode: mode,
      onChange: (newMode) => {
        setMode(newMode);
        setError(null);
        setSelectedActivity1(null);
        setSelectedActivity2(null);
      },
    }),
    
    // Activity type filter for vs-best mode
    mode === 'vs-best' && !isRouteContext && availableTypes.length > 0 && h('div', { key: 'type-filter', className: 'tvs-comparison__type-filter' }, [
      h('label', { key: 'label' }, 'Activity Type:'),
      h('select', { 
        key: 'select',
        value: selectedActivityType,
        onChange: (e) => setSelectedActivityType(e.target.value),
        className: 'tvs-comparison__type-select'
      }, [
        h('option', { key: 'all', value: 'all' }, 'All Types'),
        ...availableTypes.map(type => 
          h('option', { key: type, value: type }, type)
        )
      ])
    ]),
    
    // Route badge
    isRouteContext && h('div', { key: 'route-badge', className: 'tvs-comparison__route-badge' },
      '📍 Your performance on this route'
    ),
    
    // Manual mode controls
    mode === 'manual' && !isRouteContext && h('div', { key: 'manual-controls', className: 'tvs-comparison__manual-controls' }, [
      h('p', { key: 'instructions', className: 'tvs-comparison__instructions' }, 
        'Search by activity title or route name. Activities will be filtered by the same type for meaningful comparisons.'
      ),
      h('div', { key: 'search-1', className: 'tvs-comparison__search-group' }, [
        h('label', { key: 'label-1' }, 'Activity 1:'),
        h(ActivitySearchDropdown, {
          key: 'dropdown-1',
          userId,
          activityType: selectedActivity1?.activity_type,
          excludeId: selectedActivity2?.id,
          onSelect: setSelectedActivity1,
          placeholder: 'Type at least 2 characters to search...',
        }),
      ]),
      h('div', { key: 'search-2', className: 'tvs-comparison__search-group' }, [
        h('label', { key: 'label-2' }, 'Activity 2:'),
        h(ActivitySearchDropdown, {
          key: 'dropdown-2',
          userId,
          activityType: selectedActivity1?.activity_type, // Same type
          excludeId: selectedActivity1?.id,
          onSelect: setSelectedActivity2,
          placeholder: selectedActivity1 ? 'Search for second activity...' : 'Select first activity first',
        }),
        !selectedActivity1 && h('p', { key: 'first-activity-hint', className: 'tvs-comparison__hint' },
          '💡 Select an activity above first'
        ),
      ]),
      selectedActivity1 && selectedActivity2 && 
        selectedActivity1.activity_type !== selectedActivity2.activity_type &&
        h('div', { key: 'type-mismatch-warning', className: 'tvs-comparison__warning' },
          '⚠️ Comparing different activity types is not meaningful'
        ),
    ]),

    // Info/error messages
    error && !activity2 && h('div', { key: 'info', className: 'tvs-comparison__info' },
      h('p', null, 'ℹ️ ', error)
    ),

    // Empty state for manual mode
    mode === 'manual' && !activity1 && !loading && h('div', { key: 'empty-state', className: 'tvs-empty-state' },
      h('p', null, '👆 Select two activities above to compare')
    ),

    // Comparison table
    activity1 && activity2 && h('div', { key: 'comparison-table' }, renderComparisonTable(activity1, activity2)),
  ]);

  function renderComparisonTable(act1, act2) {
    // Different metrics for different activity types
    const activityType = act1.activity_type;
    let metrics;

    if (activityType === 'Swim') {
      // Swim-specific metrics: laps and pace per lap
      metrics = [
        { key: 'laps', label: 'Laps', format: (v) => v || 'N/A', lowerIsBetter: false },
        { key: 'duration_s', label: 'Duration', format: formatDuration, lowerIsBetter: true },
        { key: 'pace_per_lap', label: 'Pace per Lap', format: formatDuration, lowerIsBetter: true, computed: true },
        { key: 'distance_m', label: 'Distance', format: formatDistance, lowerIsBetter: false },
        { key: 'rating', label: 'Rating', format: (v) => v ? `${v}/10` : 'N/A', lowerIsBetter: false },
      ];
    } else if (activityType === 'Workout') {
      // Workout-specific metrics (no distance/pace/speed)
      metrics = [
        { key: 'duration_s', label: 'Duration', format: formatDuration, lowerIsBetter: false }, // Longer workout = better
        { key: 'sets', label: 'Sets', format: (v) => v || 'N/A', lowerIsBetter: false },
        { key: 'reps', label: 'Reps', format: (v) => v || 'N/A', lowerIsBetter: false },
        { key: 'weight', label: 'Weight (kg)', format: (v) => v ? `${v} kg` : 'N/A', lowerIsBetter: false },
        { key: 'rating', label: 'Rating', format: (v) => v ? `${v}/10` : 'N/A', lowerIsBetter: false },
      ];
    } else {
      // Default metrics for Run, Ride, Walk, Hike
      metrics = [
        { key: 'distance_m', label: 'Distance', format: formatDistance, lowerIsBetter: false },
        { key: 'duration_s', label: 'Duration', format: formatDuration, lowerIsBetter: true },
        { key: 'pace', label: 'Pace', format: formatPace, lowerIsBetter: true, computed: true },
        { key: 'speed', label: 'Speed', format: formatSpeed, lowerIsBetter: false, computed: true },
        { key: 'rating', label: 'Rating', format: (v) => v ? `${v}/10` : 'N/A', lowerIsBetter: false },
      ];
    }

    return h('div', { className: 'tvs-comparison__container' }, [
      // Column headers with activity info
      h('div', { key: 'header-row', className: 'tvs-comparison__header-row' }, [
        h('div', { key: 'label-header', className: 'tvs-comparison__header-label' }, 'Metric'),
        h('div', { key: 'activity1-header', className: 'tvs-comparison__header-activity' }, [
          h('div', { key: 'title', className: 'tvs-comparison__header-title' }, decodeHTML(act1.title)),
          h('div', { key: 'date', className: 'tvs-comparison__header-date' }, 
            new Date(act1.date).toLocaleDateString('en-US', { 
              month: 'short', day: 'numeric', year: 'numeric' 
            })
          ),
        ]),
        h('div', { key: 'diff-header', className: 'tvs-comparison__header-diff' }, 'Change'),
        h('div', { key: 'activity2-header', className: 'tvs-comparison__header-activity' }, [
          h('div', { key: 'title', className: 'tvs-comparison__header-title' }, decodeHTML(act2.title)),
          h('div', { key: 'date', className: 'tvs-comparison__header-date' }, 
            new Date(act2.date).toLocaleDateString('en-US', { 
              month: 'short', day: 'numeric', year: 'numeric' 
            })
          ),
        ]),
      ]),

      // Metrics table
      h('div', { key: 'metrics-table', className: 'tvs-comparison__table' },
        metrics.map(metric => {
          const val1 = metric.computed ? computeMetric(act1, metric.key) : act1[metric.key];
          const val2 = metric.computed ? computeMetric(act2, metric.key) : act2[metric.key];
          const diff = calculateDifference(val1, val2, metric.lowerIsBetter);

          return h('div', { key: metric.key, className: 'tvs-comparison__row' }, [
            h('div', { key: 'label', className: 'tvs-comparison__label' }, metric.label),
            h('div', { key: 'val1', className: 'tvs-comparison__value' }, metric.format(val1)),
            h('div', { key: 'diff', className: `tvs-comparison__difference tvs-comparison__difference--${diff.type}` }, 
              diff.icon ? `${diff.icon} ${diff.text}` : diff.text
            ),
            h('div', { key: 'val2', className: 'tvs-comparison__value' }, metric.format(val2)),
          ]);
        })
      ),
    ]);
  }
};

// Helper functions
function computeMetric(activity, key) {
  if (key === 'pace') {
    const distance_km = activity.distance_m / 1000;
    const duration_min = activity.duration_s / 60;
    return distance_km > 0 ? duration_min / distance_km : null;
  } else if (key === 'speed') {
    const distance_km = activity.distance_m / 1000;
    const duration_h = activity.duration_s / 3600;
    return duration_h > 0 ? distance_km / duration_h : null;
  } else if (key === 'pace_per_lap') {
    // Swim: time per lap (in seconds)
    const laps = activity.laps || 0;
    return laps > 0 ? activity.duration_s / laps : null;
  }
  return null;
}

function calculateDifference(val1, val2, lowerIsBetter) {
  if (!val1 || !val2) {
    return { text: 'N/A', type: 'neutral', icon: null };
  }

  const diff = val1 - val2;
  const percentDiff = Math.abs((diff / val2) * 100);

  if (percentDiff < 0.5) {
    return { text: 'Same', type: 'neutral', icon: '=' };
  }

  const isImprovement = lowerIsBetter ? diff < 0 : diff > 0;

  if (isImprovement) {
    return { 
      text: `${percentDiff.toFixed(1)}%`, 
      type: 'positive', 
      icon: '▲' 
    };
  } else {
    return { 
      text: `${percentDiff.toFixed(1)}%`, 
      type: 'negative', 
      icon: '▼' 
    };
  }
}

function formatDistance(meters) {
  return meters ? `${(meters / 1000).toFixed(2)} km` : 'N/A';
}

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hours > 0 
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatPace(pace) {
  if (!pace || pace === Infinity) return 'N/A';
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace % 1) * 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

function formatSpeed(speed) {
  return speed ? `${speed.toFixed(2)} km/h` : 'N/A';
}

// Mount component
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tvs-comparison-block').forEach(el => {
    const userId = parseInt(el.dataset.userId) || 0;
    const mode = el.dataset.mode || 'vs-best';
    const activityId1 = parseInt(el.dataset.activityId1) || 0;
    const activityId2 = parseInt(el.dataset.activityId2) || 0;
    const routeId = parseInt(el.dataset.routeId) || 0;
    const title = el.dataset.title || 'Activity Comparison';

    const root = createRoot(el);
    root.render(
      h(ActivityComparison, {
        userId,
        mode,
        activityId1,
        activityId2,
        routeId,
        title
      })
    );
  });
});
