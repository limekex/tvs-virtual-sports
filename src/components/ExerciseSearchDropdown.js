/**
 * ExerciseSearchDropdown Component
 *
 * Autocomplete dropdown for exercise library search.
 * Features:
 * - Debounced search (300ms)
 * - Min 2 characters required
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Shows category and difficulty badges
 * - Click outside to close
 * - Loading states
 * - Uses React Portal to escape stacking context issues
 *
 * @package TVS_Virtual_Sports
 * @since 1.3.0
 */

import { React, ReactDOM } from '../utils/reactMount.js';

const { useState, useEffect, useRef } = React;

/**
 * Debounce utility
 */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * ExerciseSearchDropdown Component
 *
 * @param {Object} props
 * @param {string} props.value - Current input value
 * @param {Function} props.onChange - Input change handler (value)
 * @param {Function} props.onSelect - Exercise selection handler ({id, name, default_metric})
 * @param {string} props.placeholder - Input placeholder
 * @param {string} props.className - Additional CSS class
 */
function ExerciseSearchDropdown({ value, onChange, onSelect, placeholder = 'Search exercises...', className = '' }) {
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const debouncedSearchTerm = useDebounce(value, 300);

  // Update dropdown position when shown
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [showDropdown]);

  // Recalculate position on scroll/resize
  useEffect(() => {
    if (!showDropdown) return;

    const updatePosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showDropdown]);

  // Search exercises when debounced term changes
  useEffect(() => {
    const searchExercises = async () => {
      if (debouncedSearchTerm.length < 2) {
        setResults([]);
        setShowDropdown(false);
        setError('');
        return;
      }

      setIsSearching(true);
      setError('');

      try {
        const url = `${window.TVS_SETTINGS.restRoot}tvs/v1/exercises/search?q=${encodeURIComponent(debouncedSearchTerm)}&limit=10`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': window.TVS_SETTINGS.nonce,
          },
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();
        setResults(data.results || []); // API returns 'results' not 'exercises'
        setShowDropdown(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Exercise search error:', err);
        setError('Search failed. Try again.');
        setResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    };

    searchExercises();
  }, [debouncedSearchTerm]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Handle exercise selection
  const handleSelect = (exercise) => {
    console.log('Exercise selected:', exercise);
    onSelect({
      id: exercise.id,
      name: exercise.name,
      default_metric: exercise.default_metric || 'reps',
    });
    setResults([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    // Note: Don't clear input here - let parent component handle it
  };

  // Difficulty badge color
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner':
        return '#10b981'; // green
      case 'intermediate':
        return '#f59e0b'; // orange
      case 'advanced':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  // Render dropdown with React Portal to escape stacking contexts
  const renderDropdown = () => {
    if (!showDropdown || results.length === 0) return null;

    return ReactDOM.createPortal(
      React.createElement(
        'div',
        {
          ref: dropdownRef,
          className: 'tvs-exercise-dropdown',
          style: {
            position: 'absolute',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 999999,
          },
        },
        results.map((exercise, idx) =>
          React.createElement(
            'div',
            {
              key: exercise.id,
              className: `tvs-exercise-result ${idx === selectedIndex ? 'tvs-exercise-result-selected' : ''}`,
              onClick: () => handleSelect(exercise),
              onMouseEnter: () => setSelectedIndex(idx),
            },
            React.createElement(
              'div',
              null,
              React.createElement(
                'div',
                null,
                React.createElement(
                  'div',
                  null,
                  exercise.name
                ),
                React.createElement(
                  'div',
                  null,
                  exercise.category && React.createElement(
                    'span',
                    {
                      className: 'tvs-badge tvs-badge-category',
                    },
                    exercise.category
                  ),
                  exercise.difficulty && React.createElement(
                    'span',
                    {
                      className: 'tvs-badge tvs-badge-difficulty',
                      style: {
                        background: getDifficultyColor(exercise.difficulty),
                      },
                    },
                    exercise.difficulty
                  ),
                  exercise.default_metric && React.createElement(
                    'span',
                    {
                      className: 'tvs-badge-metric',
                    },
                    exercise.default_metric === 'reps' ? '🔢 Reps' : '⏱ Time'
                  )
                )
              )
            )
          )
        ),
        results.length === 0 && !isSearching && debouncedSearchTerm.length >= 2 && React.createElement(
          'div',
          { style: { padding: '12px 16px', color: 'var(--tvs-text-secondary)', fontSize: '14px' } },
          'No exercises found'
        )
      ),
      document.body
    );
  };

  return React.createElement(
    'div',
    { className: `tvs-exercise-search-container ${className}` },
    React.createElement('input', {
      ref: inputRef,
      type: 'text',
      placeholder,
      value,
      onChange: (e) => onChange(e.target.value),
      onKeyDown: handleKeyDown,
      onFocus: () => {
        if (results.length > 0) setShowDropdown(true);
      },
      className: 'tvs-exercise-input tvs-input-name',
      autoComplete: 'off',
    }),
    isSearching && React.createElement(
      'div',
      { className: 'tvs-search-spinner' },
      '🔍'
    ),
    error && React.createElement(
      'div',
      { className: 'tvs-search-error' },
      error
    ),
    renderDropdown()
  );
}

// Export as default for import in ManualActivityTracker
export default ExerciseSearchDropdown;
