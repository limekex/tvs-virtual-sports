import { DEBUG, log } from '../utils/debug.js';
import ExerciseSearchDropdown from './ExerciseSearchDropdown.js';

const { useState, useEffect, useRef } = window.React;

/**
 * Helper to make authenticated API requests
 */
async function apiFetch(url, options = {}) {
  const fullUrl = url.startsWith('/wp-json') ? url : `/wp-json${url}`;
  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': window.TVS_SETTINGS?.nonce || '',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * ManualActivityTracker - Main component for Issue #21
 * 
 * Allows users to track manual indoor activities (treadmill, stationary bike, etc.)
 * Features:
 * - Activity type selection (Run, Ride, Walk, Hike, Swim, Workout)
 * - Live dashboard with timer and metrics
 * - Speed, incline, cadence, power controls
 * - Auto-save every 30 seconds
 * - Session recovery from localStorage
 * - Pause/Resume/Finish controls
 * - Strava upload option after finish
 */
export default function ManualActivityTracker({
  React,
  title,
  showTypeSelector,
  allowedTypes,
  autoStart,
  defaultType,
}) {
  const [step, setStep] = useState('select'); // 'select', 'tracking', 'calibration', 'finished'
  const [mode, setMode] = useState('live'); // 'live' or 'retrospective'
  const [selectedType, setSelectedType] = useState(defaultType);
  const [calibratedValues, setCalibratedValues] = useState(null); // For storing calibrated values before finish
  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activityId, setActivityId] = useState(null);
  const [permalink, setPermalink] = useState(null);
  const [uploadingToStrava, setUploadingToStrava] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [editingField, setEditingField] = useState(null); // Track which field is being edited
  const [editValue, setEditValue] = useState(''); // Temporary edit value
  const [editingMainTimer, setEditingMainTimer] = useState(false); // Track if main timer is being edited

  // Metrics state
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [pace, setPace] = useState(0);
  const [incline, setIncline] = useState(0);
  const [cadence, setCadence] = useState(0);
  const [power, setPower] = useState(0);
  const [laps, setLaps] = useState(0);
  const [poolLength, setPoolLength] = useState(25); // meters
  const [workoutExercises, setWorkoutExercises] = useState([]); // Array of {name, sets, reps, weight, exercise_id}
  const [currentExerciseName, setCurrentExerciseName] = useState('');
  const [currentExerciseId, setCurrentExerciseId] = useState(null); // ID from library (if selected)
  const [currentSets, setCurrentSets] = useState(3);
  const [currentReps, setCurrentReps] = useState(10);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [currentMetricType, setCurrentMetricType] = useState('reps'); // 'reps' or 'time'

  // Calibration state (for live mode before finishing)
  const [calibDuration, setCalibDuration] = useState(0);
  const [calibDistance, setCalibDistance] = useState(0);
  const [calibIncline, setCalibIncline] = useState(0);
  const [calibCadence, setCalibCadence] = useState(0);
  const [calibPower, setCalibPower] = useState(0);
  const [calibLaps, setCalibLaps] = useState(0);

  const timerRef = useRef(null);
  const autoSaveRef = useRef(null);
  const startTimeRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to top when step changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [step]);

  // Auto-calculate distance and pace for Swim activities
  useEffect(() => {
    if (selectedType === 'Swim' && laps > 0 && poolLength > 0) {
      const distanceKm = parseFloat((laps * poolLength / 1000).toFixed(2));
      setDistance(distanceKm);
      
      // Calculate pace (seconds per lap) if we have duration
      if (elapsedTime > 0 && laps > 0) {
        const paceValue = Math.round(elapsedTime / laps);
        setPace(paceValue);
      }
    }
  }, [laps, poolLength, elapsedTime, selectedType]);

  // Auto-start if configured (only in live mode)
  useEffect(() => {
    if (autoStart && !showTypeSelector && mode === 'live') {
      handleStartActivity(defaultType);
    }
  }, []);

  // Check for saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem('tvs_manual_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.sessionId && data.type) {
          // Prompt user to recover session
          if (confirm('You have an unfinished activity. Do you want to continue?')) {
            setSessionId(data.sessionId);
            setSelectedType(data.type);
            setMode(data.mode || 'live');
            setElapsedTime(data.elapsed_time || 0);
            setDistance(data.distance || 0);
            setSpeed(data.speed || 0);
            setPace(data.pace || 0);
            setIncline(data.incline || 0);
            setCadence(data.cadence || 0);
            setPower(data.power || 0);
            setStep('tracking');
            if (mode === 'live') {
              startTimeRef.current = Date.now() - (data.elapsed_time || 0) * 1000;
              startTimer();
            }
          } else {
            localStorage.removeItem('tvs_manual_session');
          }
        }
      } catch (e) {
        if (DEBUG) log('Failed to parse saved session:', e);
        localStorage.removeItem('tvs_manual_session');
      }
    }
  }, []);

  // Timer logic
  const startTimer = () => {
    if (timerRef.current || mode === 'retrospective') return; // Don't start timer in retrospective mode
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedTime(elapsed);
        
        // Auto-calculate distance from speed (only in live mode)
        if (mode === 'live' && speed > 0) {
          const distanceKm = (speed * elapsed) / 3600;
          setDistance(parseFloat(distanceKm.toFixed(2)));
        }
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Auto-save logic (every 30 seconds)
  useEffect(() => {
    if (step === 'tracking' && sessionId && !isPaused) {
      autoSaveRef.current = setInterval(() => {
        handleUpdateSession(false); // Silent update, no flash message
      }, 30000);
    }
    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    };
  }, [step, sessionId, isPaused, elapsedTime, distance, speed, pace, incline, cadence, power]);

  // Save to localStorage whenever metrics change
  useEffect(() => {
    if (step === 'tracking' && sessionId) {
      localStorage.setItem('tvs_manual_session', JSON.stringify({
        sessionId,
        type: selectedType,
        mode,
        elapsed_time: elapsedTime,
        distance,
        speed,
        pace,
        incline,
        cadence,
        power,
      }));
    }
  }, [step, sessionId, elapsedTime, distance, speed, pace, incline, cadence, power]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  // API: Start session
  const handleStartActivity = async (type) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/tvs/v1/activities/manual/start', {
        method: 'POST',
        body: JSON.stringify({ type }),
      });

      if (result.success && result.session_id) {
        setSessionId(result.session_id);
        setSessionData(result.session_data);
        setSelectedType(type);
        setStep('tracking');
        if (mode === 'live') {
          startTimeRef.current = Date.now();
          startTimer();
        }
        if (typeof window.tvsFlash === 'function') {
          window.tvsFlash(`${type} activity started!`, 'success');
        }
      } else {
        throw new Error(data.message || 'Failed to start activity');
      }
    } catch (err) {
      setError(err.message);
      if (typeof window.tvsFlash === 'function') {
        window.tvsFlash(err.message, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // API: Update session metrics
  const handleUpdateSession = async (showMessage = true) => {
    if (!sessionId) return;

    try {
      const payload = {
        elapsed_time: elapsedTime,
        distance,
        speed,
        pace,
        incline,
        cadence,
        power,
      };

      // Add workout-specific data
      if (selectedType === 'Workout') {
        payload.exercises = workoutExercises; // Array of {name, exercise_id, sets, reps, weight, metric_type}
      }

      // Add swim-specific data
      if (selectedType === 'Swim') {
        payload.laps = laps;
        payload.pool_length = poolLength;
      }

      const result = await apiFetch(`/tvs/v1/activities/manual/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (result.success) {
        setSessionData(result.session_data);
        if (showMessage && typeof window.tvsFlash === 'function') {
          window.tvsFlash('💾 Progress saved', 'success');
        }
      }
    } catch (err) {
      if (DEBUG) log('Failed to update session:', err);
    }
  };

  // API: Finish activity
  const handleFinishActivity = async () => {
    if (!sessionId) return;

    // If we have calibrated values, update session with those first
    if (calibratedValues) {
      // Update state with calibrated values
      if (calibratedValues.duration !== undefined) setElapsedTime(calibratedValues.duration);
      if (calibratedValues.distance !== undefined) setDistance(calibratedValues.distance);
      if (calibratedValues.incline !== undefined) setIncline(calibratedValues.incline);
      if (calibratedValues.cadence !== undefined) setCadence(calibratedValues.cadence);
      if (calibratedValues.power !== undefined) setPower(calibratedValues.power);
      if (calibratedValues.laps !== undefined) setLaps(calibratedValues.laps);
      
      // Wait a tick for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Final update before finishing
    await handleUpdateSession(false);

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiFetch(`/tvs/v1/activities/manual/${sessionId}/finish`, {
        method: 'POST',
      });

      if (result.success && result.activity_id) {
        setActivityId(result.activity_id);
        setPermalink(result.permalink);
        setStep('finished');
        stopTimer();
        localStorage.removeItem('tvs_manual_session');
        
        // Dispatch event to update My Activities block
        window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
        
        if (typeof window.tvsFlash === 'function') {
          window.tvsFlash('🎉 Activity saved successfully!', 'success');
        }
      } else {
        throw new Error(data.message || 'Failed to finish activity');
      }
    } catch (err) {
      setError(err.message);
      if (typeof window.tvsFlash === 'function') {
        window.tvsFlash(err.message, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Upload to Strava
  const uploadToStrava = async () => {
    if (!activityId) return;
    try {
      setUploadingToStrava(true);
      const response = await fetch(`/wp-json/tvs/v1/activities/${activityId}/strava`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': window.TVS_SETTINGS?.nonce || ''
        },
        credentials: 'same-origin',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }
      if (typeof window.tvsFlash === 'function') {
        window.tvsFlash('👍 Uploaded to Strava!', 'success');
      }
      window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
    } catch (err) {
      console.error('Strava upload failed:', err);
      if (typeof window.tvsFlash === 'function') {
        window.tvsFlash('Failed to upload to Strava: ' + (err?.message || String(err)), 'error');
      }
    } finally {
      setUploadingToStrava(false);
    }
  };

  // Cancel activity (retrospective mode)
  const handleCancelActivity = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = () => {
    // Clear localStorage
    localStorage.removeItem('tvsManualActivitySession');
    
    // Reset to initial state
    setSelectedType('');
    setElapsedTime(0);
    setDistance(0);
    setSpeed(0);
    setIncline(0);
    setCadence(0);
    setPower(0);
    setLaps(0);
    setPoolLength(25);
    setWorkoutExercises([]);
    setCurrentExerciseName('');
    setCurrentSets(3);
    setCurrentReps(10);
    setCurrentWeight(0);
    setCurrentMetricType('reps');
    setIsPaused(false);
    setSessionId(null);
    setStep('select');
    setShowCancelModal(false);
    
    if (typeof window.tvsFlash === 'function') {
      window.tvsFlash('Activity cancelled', 'info');
    }
  };

  // Pause/Resume
  const handleTogglePause = () => {
    if (isPaused) {
      // Resume
      startTimeRef.current = Date.now() - elapsedTime * 1000;
      setIsPaused(false);
      startTimer();
      if (typeof window.tvsFlash === 'function') {
        window.tvsFlash('▶️ Activity resumed', 'success');
      }
    } else {
      // Pause
      stopTimer(); // Stop the timer interval
      setIsPaused(true);
      if (typeof window.tvsFlash === 'function') {
        window.tvsFlash('⏸ Activity paused', 'info');
      }
    }
  };

  // Format time as HH:MM:SS
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format pace as MM:SS (no hours, for pace display)
  const formatTimePace = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Parse time string (h:mm:ss, mm:ss, or ss) to seconds
  const parseTimeInput = (input) => {
    if (!input) return 0;
    const parts = input.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      // h:mm:ss
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // mm:ss
      return parts[0] * 60 + parts[1];
    } else {
      // just seconds
      return parts[0];
    }
  };

  // Handle inline edit save
  const handleInlineEdit = (field, value) => {
    switch (field) {
      case 'duration':
        const seconds = parseTimeInput(value);
        setElapsedTime(Math.max(0, seconds));
        break;
      case 'distance':
        setDistance(Math.max(0, parseFloat(value) || 0));
        break;
      case 'speed':
        setSpeed(Math.max(0, parseFloat(value) || 0));
        break;
      case 'incline':
        setIncline(Math.max(-5, Math.min(15, parseFloat(value) || 0)));
        break;
      case 'cadence':
        setCadence(Math.max(0, parseInt(value, 10) || 0));
        break;
      case 'power':
        setPower(Math.max(0, parseInt(value, 10) || 0));
        break;
      case 'laps':
        setLaps(Math.max(0, parseInt(value, 10) || 0));
        break;
    }
    setEditingField(null);
    setEditValue('');
  };

  // Calculate pace from speed
  useEffect(() => {
    if (speed > 0) {
      setPace(parseFloat((60 / speed).toFixed(2)));
    } else {
      setPace(0);
    }
  }, [speed]);

  // Get metrics configuration based on activity type
  const getMetricsConfig = () => {
    const baseConfig = {
      'Run': { display: ['distance', 'speed', 'pace', 'incline'], controls: ['speed', 'incline', 'cadence'] },
      'Walk': { display: ['distance', 'speed', 'pace', 'incline'], controls: ['speed', 'incline', 'cadence'] },
      'Hike': { display: ['distance', 'speed', 'pace', 'incline'], controls: ['speed', 'incline', 'cadence'] },
      'Ride': { display: ['distance', 'speed', 'incline', 'cadence'], controls: ['speed', 'incline', 'cadence', 'power'] },
      'Swim': { display: ['laps', 'poolLength', 'distance', 'pace'], controls: ['laps', 'poolLength'] },
      'Workout': { display: [], controls: [] }
    };

    const config = baseConfig[selectedType] || { display: ['distance', 'speed', 'pace'], controls: ['speed'] };
    
    // In retrospective mode, replace speed controls with distance and duration
    if (mode === 'retrospective') {
      if (['Run', 'Walk', 'Hike', 'Ride'].includes(selectedType)) {
        config.controls = ['distance', 'duration', 'incline', 'cadence'];
        if (selectedType === 'Ride') config.controls.push('power');
      } else if (selectedType === 'Swim') {
        config.controls = ['laps', 'poolLength', 'duration'];
      } else if (selectedType === 'Workout') {
        config.controls = ['duration'];
      }
    }
    
    return config;
  };

  const metricsConfig = getMetricsConfig();

  // Render metrics based on activity type
  const renderMetric = (type) => {
    const metricDefs = {
      distance: { label: 'Distance (km)', value: distance.toFixed(2) },
      speed: { label: 'Speed (km/h)', value: speed.toFixed(1) },
      pace: { label: selectedType === 'Swim' ? 'Pace (sec/lap)' : 'Pace (min/km)', value: pace > 0 ? (selectedType === 'Swim' ? pace : formatTimePace(pace)) : '—' },
      incline: { label: 'Incline (%)', value: incline.toFixed(1) },
      cadence: { label: selectedType === 'Run' ? 'Cadence (SPM)' : 'Cadence (RPM)', value: cadence },
      laps: { label: 'Laps', value: laps },
      poolLength: { label: 'Pool Length (m)', value: poolLength }
    };
    
    const metric = metricDefs[type];
    if (!metric) return null;
    
    return React.createElement(
      'div',
      { className: 'tvs-metric', key: type },
      React.createElement('label', null, metric.label),
      React.createElement('div', { className: 'tvs-metric-value' }, metric.value)
    );
  };

  // Render control based on activity type
  const renderControl = (type) => {
    const controls = {
      distance: {
        label: 'Distance (km)',
        value: distance.toFixed(2),
        onDecrease: () => setDistance(Math.max(0, parseFloat((distance - 0.1).toFixed(2)))),
        onIncrease: () => setDistance(parseFloat((distance + 0.1).toFixed(2)))
      },
      duration: {
        label: 'Duration (h:mm:ss)',
        value: formatTime(elapsedTime),
        onDecrease: () => setElapsedTime(Math.max(0, elapsedTime - 60)),
        onIncrease: () => setElapsedTime(elapsedTime + 60)
      },
      speed: {
        label: 'Speed (km/h)',
        value: speed.toFixed(1),
        onDecrease: () => setSpeed(Math.max(0, speed - 0.5)),
        onIncrease: () => setSpeed(speed + 0.5)
      },
      incline: {
        label: 'Incline (%)',
        value: incline.toFixed(1) + '%',
        onDecrease: () => setIncline(Math.max(-5, parseFloat((incline - 0.5).toFixed(1)))),
        onIncrease: () => setIncline(Math.min(15, parseFloat((incline + 0.5).toFixed(1))))
      },
      cadence: {
        label: selectedType === 'Run' ? 'Cadence (SPM)' : 'Cadence (RPM)',
        value: cadence,
        onDecrease: () => setCadence(Math.max(0, cadence - 5)),
        onIncrease: () => setCadence(cadence + 5)
      },
      power: {
        label: 'Power (W)',
        value: power,
        onDecrease: () => setPower(Math.max(0, power - 10)),
        onIncrease: () => setPower(power + 10)
      },
      laps: {
        label: 'Laps',
        value: laps,
        onDecrease: () => setLaps(Math.max(0, laps - 1)),
        onIncrease: () => setLaps(laps + 1)
      },
      poolLength: {
        label: 'Pool Length (m)',
        value: poolLength,
        onDecrease: () => setPoolLength(poolLength === 50 ? 25 : 25),
        onIncrease: () => setPoolLength(poolLength === 25 ? 50 : 50)
      }
    };
    
    const control = controls[type];
    if (!control) return null;
    
    const isEditing = editingField === type;
    const canEdit = mode === 'retrospective';
    
    return React.createElement(
      'div',
      { className: 'tvs-control-row', key: type },
      React.createElement('label', null, control.label),
      React.createElement(
        'div',
        { className: 'tvs-control-buttons' },
        (type === 'duration' || type === 'distance') && canEdit && React.createElement(
          'button', 
          { 
            onClick: type === 'duration' ? () => setElapsedTime(Math.max(0, elapsedTime - 1)) : () => setDistance(Math.max(0, parseFloat((distance - 0.01).toFixed(2)))), 
            className: 'tvs-btn-small' 
          }, 
          type === 'duration' ? '−1s' : '−0.01'
        ),
        React.createElement('button', { onClick: control.onDecrease }, '−'),
        isEditing ? React.createElement('input', {
          type: 'text',
          className: 'tvs-inline-edit',
          value: editValue,
          onChange: (e) => setEditValue(e.target.value),
          onBlur: () => handleInlineEdit(type, editValue),
          onKeyDown: (e) => {
            if (e.key === 'Enter') handleInlineEdit(type, editValue);
            if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
          },
          autoFocus: true,
          placeholder: type === 'duration' ? 'h:mm:ss' : control.value
        }) : React.createElement(
          'span',
          { 
            onClick: canEdit ? () => {
              setEditingField(type);
              setEditValue(
                type === 'duration' ? formatTime(elapsedTime) :
                type === 'distance' ? distance.toFixed(2) :
                type === 'speed' ? speed.toFixed(1) :
                type === 'incline' ? incline.toFixed(1) :
                String(control.value)
              );
            } : null,
            className: canEdit ? 'tvs-editable' : '',
            title: canEdit ? 'Click to edit' : ''
          }, 
          control.value
        ),
        React.createElement('button', { onClick: control.onIncrease }, '+'),
        (type === 'duration' || type === 'distance') && canEdit && React.createElement(
          'button', 
          { 
            onClick: type === 'duration' ? () => setElapsedTime(elapsedTime + 1) : () => setDistance(parseFloat((distance + 0.01).toFixed(2))), 
            className: 'tvs-btn-small' 
          }, 
          type === 'duration' ? '+1s' : '+0.01'
        )
      )
    );
  };

  // Render: Type selection
  if (step === 'select') {
    return React.createElement(
      'div',
      { className: 'tvs-manual-tracker tvs-card', ref: containerRef },
      React.createElement('h3', { className: 'tvs-tracker-title' }, title),
      
      // Mode selector
      React.createElement(
        'div',
        { className: 'tvs-mode-selector' },
        React.createElement(
          'button',
          {
            className: `tvs-mode-btn ${mode === 'live' ? 'active' : ''}`,
            onClick: () => setMode('live')
          },
          '⏱️ Track Live',
          React.createElement('span', { className: 'tvs-mode-desc' }, 'Real-time tracking')
        ),
        React.createElement(
          'button',
          {
            className: `tvs-mode-btn ${mode === 'retrospective' ? 'active' : ''}`,
            onClick: () => setMode('retrospective')
          },
          '📝 Log Past Activity',
          React.createElement('span', { className: 'tvs-mode-desc' }, 'Enter completed activity')
        )
      ),
      
      showTypeSelector && React.createElement(
        'div',
        { className: 'tvs-type-selector' },
        allowedTypes.map((type) =>
          React.createElement(
            'button',
            {
              key: type,
              className: `tvs-type-btn ${selectedType === type ? 'active' : ''}`,
              onClick: () => setSelectedType(type),
              disabled: isLoading,
            },
            getActivityIcon(type),
            React.createElement('span', null, type)
          )
        )
      ),
      React.createElement(
        'button',
        {
          className: 'tvs-btn tvs-btn-primary',
          onClick: () => handleStartActivity(selectedType),
          disabled: isLoading,
        },
        isLoading ? 'Starting...' : `Start ${selectedType}`
      )
    );
  }

  // Render: Tracking dashboard
  if (step === 'tracking') {
    return React.createElement(
      'div',
      { className: 'tvs-manual-tracker tvs-dashboard tvs-card', ref: containerRef },
      React.createElement(
        'div',
        { className: 'tvs-dashboard-header' },
        React.createElement(
          'div',
          null,
          React.createElement('h3', { className: 'tvs-tracker-title' }, `${selectedType} Activity`),
          React.createElement(
            'span',
            { className: 'tvs-badge tvs-badge-accent', style: { fontSize: 'var(--tvs-text-xs)', marginTop: 'var(--tvs-space-1)' } },
            mode === 'retrospective' ? '📝 Retrospective' : '⏱️ Live'
          )
        ),
        editingMainTimer ? React.createElement('input', {
          type: 'text',
          className: 'tvs-timer-edit',
          value: editValue,
          onChange: (e) => setEditValue(e.target.value),
          onBlur: () => {
            handleInlineEdit('duration', editValue);
            setEditingMainTimer(false);
          },
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              handleInlineEdit('duration', editValue);
              setEditingMainTimer(false);
            }
            if (e.key === 'Escape') {
              setEditingMainTimer(false);
              setEditValue('');
            }
          },
          autoFocus: true,
          placeholder: 'h:mm:ss'
        }) : React.createElement(
          'div',
          { 
            className: mode === 'retrospective' ? 'tvs-timer tvs-timer-editable' : 'tvs-timer',
            onClick: mode === 'retrospective' ? () => {
              setEditingMainTimer(true);
              setEditValue(formatTime(elapsedTime));
            } : null,
            title: mode === 'retrospective' ? 'Click to edit time' : ''
          },
          formatTime(elapsedTime)
        )
      ),
      
      // Metrics display (activity-specific)
      React.createElement(
        'div',
        { className: 'tvs-metrics-grid' },
        metricsConfig.display.map(renderMetric)
      ),

      // Controls (activity-specific)
      React.createElement(
        'div',
        { className: 'tvs-controls' },
        React.createElement('h4', null, 'Adjust Metrics'),
        mode === 'retrospective' && React.createElement(
          'p',
          { className: 'tvs-controls-hint' },
          '💡 Click on any value to edit directly'
        ),
        metricsConfig.controls.map(renderControl)
      ),

      // Workout Exercises (only for Workout type)
      selectedType === 'Workout' && React.createElement(
        'div',
        { className: 'tvs-workout-exercises' },
        React.createElement('h4', null, 'Strength Training'),
        React.createElement(
          'p',
          { className: 'tvs-workout-hint' },
          `Add each exercise with its sets, reps, and weight. Track different loads per exercise.`
        ),
        workoutExercises.length > 0 && React.createElement(
          'div',
          { className: 'tvs-exercise-list' },
          workoutExercises.map((exercise, idx) =>
            React.createElement(
              'div',
              { key: idx, className: 'tvs-exercise-item' },
              React.createElement('span', { className: 'tvs-exercise-number' }, `${idx + 1}.`),
              React.createElement('span', { className: 'tvs-exercise-name' }, exercise.name),
              React.createElement('span', { className: 'tvs-exercise-stats' }, 
                `${exercise.sets} × ${exercise.reps}${exercise.metric_type === 'time' ? 's' : ''}${exercise.weight > 0 ? ` @ ${exercise.weight}kg` : ''}`
              ),
              React.createElement(
                'button',
                {
                  className: 'tvs-btn-icon',
                  onClick: () => {
                    setWorkoutExercises(workoutExercises.filter((_, i) => i !== idx));
                  },
                  title: 'Remove exercise'
                },
                '✕'
              )
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'tvs-add-exercise' },
          React.createElement(
            'div',
            { className: 'tvs-exercise-form-header' },
            React.createElement('label', { className: 'tvs-form-label tvs-form-label-name' }, 'Exercise Name'),
            React.createElement('label', { className: 'tvs-form-label tvs-form-label-sets' }, 'Sets'),
            React.createElement(
              'div',
              { className: 'tvs-form-label tvs-form-label-reps tvs-metric-type-toggle' },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: currentMetricType === 'reps' ? 'tvs-toggle-btn tvs-toggle-active' : 'tvs-toggle-btn',
                  onClick: () => setCurrentMetricType('reps'),
                  title: 'Repetitions'
                },
                '🔢'
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: currentMetricType === 'time' ? 'tvs-toggle-btn tvs-toggle-active' : 'tvs-toggle-btn',
                  onClick: () => setCurrentMetricType('time'),
                  title: 'Time (seconds)'
                },
                '⏱'
              )
            ),
            React.createElement('label', { className: 'tvs-form-label tvs-form-label-weight' }, 'Weight (kg)')
          ),
          React.createElement(
            'div',
            { className: 'tvs-exercise-form-inputs' },
            React.createElement(ExerciseSearchDropdown, {
              value: currentExerciseName,
              onChange: (value) => {
                setCurrentExerciseName(value);
                // Clear exercise_id when user types (custom exercise)
                if (currentExerciseId) {
                  setCurrentExerciseId(null);
                }
              },
              onSelect: (exercise) => {
                console.log('ManualActivityTracker: Exercise selected', exercise);
                setCurrentExerciseName(exercise.name);
                setCurrentExerciseId(exercise.id);
                setCurrentMetricType(exercise.default_metric || 'reps');
                if (exercise.default_metric === 'time') {
                  setCurrentReps(60); // Default 60 seconds
                } else {
                  setCurrentReps(10); // Default 10 reps
                }
              },
              placeholder: 'Search or type exercise name...',
              className: 'tvs-exercise-search'
            }),
            React.createElement('input', {
              type: 'number',
              placeholder: '3',
              value: currentSets,
              min: '1',
              onChange: (e) => setCurrentSets(Math.max(1, parseInt(e.target.value) || 1)),
              className: 'tvs-exercise-number tvs-input-sets'
            }),
            React.createElement('input', {
              type: 'number',
              placeholder: currentMetricType === 'reps' ? '10' : '60',
              value: currentReps,
              min: '1',
              onChange: (e) => setCurrentReps(Math.max(1, parseInt(e.target.value) || 1)),
              className: 'tvs-exercise-number tvs-input-reps',
              title: currentMetricType === 'reps' ? 'Repetitions' : 'Seconds'
            }),
            React.createElement('input', {
              type: 'number',
              placeholder: '0',
              value: currentWeight,
              min: '0',
              step: '0.5',
              onChange: (e) => setCurrentWeight(Math.max(0, parseFloat(e.target.value) || 0)),
              className: 'tvs-exercise-number tvs-input-weight'
            }),
            React.createElement(
              'button',
              {
                className: 'tvs-btn tvs-btn-secondary tvs-btn-add-exercise',
                onClick: () => {
                  if (currentExerciseName.trim()) {
                    setWorkoutExercises([...workoutExercises, {
                      name: currentExerciseName.trim(),
                      exercise_id: currentExerciseId, // null if custom, ID if from library
                      sets: currentSets,
                      reps: currentReps,
                      weight: currentWeight,
                      metric_type: currentMetricType
                    }]);
                    setCurrentExerciseName('');
                    setCurrentExerciseId(null);
                    setCurrentSets(3);
                    setCurrentReps(10);
                    setCurrentWeight(0);
                    setCurrentMetricType('reps');
                  }
                },
                disabled: !currentExerciseName.trim()
              },
              '+ Add'
            )
          )
        ),
        workoutExercises.length > 0 && React.createElement(
          'div',
          { className: 'tvs-circuit-summary' },
          React.createElement('p', null, `📋 ${workoutExercises.length} exercises`),
          React.createElement(
            'p',
            null,
            `💪 ${workoutExercises.reduce((sum, ex) => sum + (ex.sets * ex.reps), 0)} total reps`
          ),
          (() => {
            const totalVolume = workoutExercises.reduce((sum, ex) => sum + (ex.sets * ex.reps * ex.weight), 0);
            return totalVolume > 0 && React.createElement(
              'p',
              null,
              `🏋️ Total volume: ${totalVolume.toFixed(1)} kg`
            );
          })()
        )
      ),

      // Action buttons
      React.createElement(
        'div',
        { className: 'tvs-action-buttons' },
        mode === 'live' && React.createElement(
          'button',
          {
            className: 'tvs-btn tvs-btn-secondary',
            onClick: handleTogglePause,
            disabled: isLoading,
          },
          isPaused ? '▶️ Resume' : '⏸ Pause'
        ),
        mode === 'live' && React.createElement(
          'button',
          {
            className: 'tvs-btn tvs-btn-secondary',
            onClick: handleUpdateSession,
            disabled: isLoading,
          },
          '💾 Save Progress'
        ),
        React.createElement(
          'button',
          {
            className: 'tvs-btn tvs-btn-danger',
            onClick: handleCancelActivity,
            disabled: isLoading,
          },
          '✕ Cancel'
        ),
        React.createElement(
          'button',
          {
            className: 'tvs-btn tvs-btn-finish',
            onClick: () => {
              // Guard: Workout must have at least one exercise
              if (selectedType === 'Workout' && workoutExercises.length === 0) {
                if (typeof window.tvsFlash === 'function') {
                  window.tvsFlash('⚠️ Add at least one exercise before finishing', 'error');
                }
                return;
              }
              
              if (mode === 'live') {
                // Go to calibration step for live activities
                stopTimer();
                // Initialize calibration values with current state
                setCalibDuration(elapsedTime);
                setCalibDistance(distance);
                setCalibIncline(incline);
                setCalibCadence(cadence);
                setCalibPower(power);
                setCalibLaps(laps);
                setStep('calibration');
              } else {
                // Skip calibration for retrospective (already manually entered)
                setShowConfirmModal(true);
              }
            },
            disabled: isLoading,
          },
          isLoading ? 'Finishing...' : '✓ Finish Activity'
        )
      ),

      isPaused && React.createElement(
        'div',
        { className: 'tvs-paused-notice tvs-badge tvs-badge-primary' },
        '⏸ Activity paused'
      ),

      // Cancel Confirmation Modal
      showCancelModal && React.createElement(
        'div',
        { className: 'tvs-modal-overlay', onClick: () => setShowCancelModal(false) },
        React.createElement(
          'div',
          { 
            className: 'tvs-modal tvs-card',
            onClick: (e) => e.stopPropagation()
          },
          React.createElement('h3', { className: 'tvs-modal-title' }, '⚠️ Cancel Activity?'),
          React.createElement(
            'p',
            { className: 'tvs-modal-text' },
            'Are you sure you want to cancel this activity? All data will be lost and cannot be recovered.'
          ),
          React.createElement(
            'div',
            { className: 'tvs-modal-actions' },
            React.createElement(
              'button',
              {
                className: 'tvs-btn tvs-btn-secondary',
                onClick: () => setShowCancelModal(false)
              },
              'Keep Activity'
            ),
            React.createElement(
              'button',
              {
                className: 'tvs-btn tvs-btn-danger',
                onClick: handleConfirmCancel
              },
              '✕ Cancel Activity'
            )
          )
        )
      ),

      // Finish Confirmation Modal
      showConfirmModal && React.createElement(
        'div',
        { className: 'tvs-modal-overlay', onClick: () => setShowConfirmModal(false) },
        React.createElement(
          'div',
          { 
            className: 'tvs-modal tvs-card',
            onClick: (e) => e.stopPropagation()
          },
          React.createElement('h3', { className: 'tvs-modal-title' }, '🏁 Finish Activity?'),
          React.createElement(
            'p',
            { className: 'tvs-modal-text' },
            `Are you sure you want to finish this ${selectedType.toLowerCase()} activity?`
          ),
          React.createElement(
            'div',
            { className: 'tvs-modal-summary' },
            React.createElement('div', null, `⏱ Duration: ${formatTime(elapsedTime)}`),
            selectedType !== 'Workout' && React.createElement('div', null, `📍 Distance: ${distance.toFixed(2)} km`),
            selectedType === 'Swim' && React.createElement('div', null, `🏊 Laps: ${laps}`),
            selectedType === 'Swim' && pace > 0 && React.createElement('div', null, `⚡ Pace: ${pace} sec/lap`),
            selectedType === 'Workout' && React.createElement('div', null, `💪 Sets: ${sets} × ${reps} reps`)
          ),
          React.createElement(
            'div',
            { className: 'tvs-modal-actions' },
            React.createElement(
              'button',
              {
                className: 'tvs-btn tvs-btn-secondary',
                onClick: () => setShowConfirmModal(false)
              },
              'Go Back'
            ),
            React.createElement(
              'button',
              {
                className: 'tvs-btn tvs-btn-finish',
                onClick: () => {
                  setShowConfirmModal(false);
                  handleFinishActivity();
                },
                disabled: isLoading
              },
              '✓ Finish'
            )
          )
        )
      )
    );
  }

  // Render: Calibration (for live mode before finishing)
  if (step === 'calibration') {
    const handleCalibrationSave = () => {
      setCalibratedValues({
        duration: calibDuration,
        distance: calibDistance,
        incline: calibIncline,
        cadence: calibCadence,
        power: calibPower,
        laps: calibLaps,
      });
      setShowConfirmModal(true);
    };

    const handleBackToTracking = () => {
      setStep('tracking');
      if (mode === 'live') {
        startTimer(); // Resume timer
      }
    };

    const renderCalibrationField = (label, value, setter, unit = '', step = 0.01, type = 'number') => {
      return React.createElement(
        'div',
        { className: 'tvs-calibration-field' },
        React.createElement('label', null, label),
        React.createElement(
          'div',
          { className: 'tvs-calibration-input-group' },
          React.createElement('input', {
            type: type,
            value: type === 'text' ? formatTime(value) : value,
            onChange: (e) => {
              if (type === 'text') {
                const seconds = parseTimeInput(e.target.value);
                setter(seconds);
              } else {
                setter(parseFloat(e.target.value) || 0);
              }
            },
            step: step,
            min: 0,
            className: 'tvs-calibration-input',
            placeholder: label
          }),
          unit && React.createElement('span', { className: 'tvs-calibration-unit' }, unit)
        )
      );
    };

    return React.createElement(
      'div',
      { className: 'tvs-manual-tracker tvs-calibration', ref: containerRef },
      React.createElement('h3', null, '🎯 Calibrate Your Results'),
      React.createElement(
        'p',
        { className: 'tvs-calibration-hint' },
        'Adjust values to match your equipment (treadmill, bike computer, watch, etc.)'
      ),
      React.createElement(
        'div',
        { className: 'tvs-calibration-grid' },
        renderCalibrationField('Duration', calibDuration, setCalibDuration, '', 1, 'text'),
        ['Run', 'Walk', 'Hike', 'Ride'].includes(selectedType) && renderCalibrationField('Distance', calibDistance, setCalibDistance, 'km', 0.01),
        ['Run', 'Walk', 'Hike', 'Ride'].includes(selectedType) && renderCalibrationField('Incline', calibIncline, setCalibIncline, '%', 0.5),
        ['Run', 'Walk', 'Hike', 'Ride'].includes(selectedType) && renderCalibrationField('Cadence', calibCadence, setCalibCadence, 'spm', 1),
        selectedType === 'Ride' && renderCalibrationField('Power', calibPower, setCalibPower, 'W', 1),
        selectedType === 'Swim' && renderCalibrationField('Laps', calibLaps, setCalibLaps, '', 1)
      ),
      React.createElement(
        'div',
        { className: 'tvs-calibration-actions' },
        React.createElement(
          'button',
          {
            className: 'tvs-btn tvs-btn-secondary',
            onClick: handleBackToTracking
          },
          '← Back to Tracking'
        ),
        React.createElement(
          'button',
          {
            className: 'tvs-btn tvs-btn-finish',
            onClick: handleCalibrationSave
          },
          '✓ Confirm & Finish'
        )
      ),

      // Finish Confirmation Modal (from calibration)
      showConfirmModal && React.createElement(
        'div',
        { className: 'tvs-modal-overlay', onClick: () => setShowConfirmModal(false) },
        React.createElement(
          'div',
          { 
            className: 'tvs-modal tvs-card',
            onClick: (e) => e.stopPropagation()
          },
          React.createElement('h3', { className: 'tvs-modal-title' }, '🏁 Finish Activity?'),
          React.createElement(
            'p',
            { className: 'tvs-modal-text' },
            `Are you sure you want to finish this ${selectedType.toLowerCase()} activity with the calibrated values?`
          ),
          React.createElement(
            'div',
            { className: 'tvs-modal-summary' },
            React.createElement('div', null, `⏱ Duration: ${formatTime(calibDuration)}`),
            selectedType !== 'Workout' && React.createElement('div', null, `📍 Distance: ${calibDistance.toFixed(2)} km`),
            selectedType === 'Swim' && React.createElement('div', null, `🏊 Laps: ${calibLaps}`),
            selectedType === 'Swim' && calibLaps > 0 && calibDuration > 0 && React.createElement('div', null, `⚡ Pace: ${Math.round(calibDuration / calibLaps)} sec/lap`),
            selectedType === 'Workout' && workoutExercises.length > 0 && React.createElement('div', null, `🏋️ Exercises: ${workoutExercises.length}`)
          ),
          React.createElement(
            'div',
            { className: 'tvs-modal-actions' },
            React.createElement(
              'button',
              {
                className: 'tvs-btn tvs-btn-secondary',
                onClick: () => setShowConfirmModal(false)
              },
              'Go Back'
            ),
            React.createElement(
              'button',
              {
                className: 'tvs-btn tvs-btn-finish',
                onClick: () => {
                  setShowConfirmModal(false);
                  handleFinishActivity();
                },
                disabled: isLoading
              },
              '✓ Finish'
            )
          )
        )
      )
    );
  }

  // Render: Finished
  if (step === 'finished') {
    // Build activity-specific summary
    const summaryItems = [
      React.createElement('p', { key: 'type' }, `Type: ${selectedType}`),
      React.createElement('p', { key: 'duration' }, `⏱ Duration: ${formatTime(elapsedTime)}`)
    ];

    // Add activity-specific metrics
    if (selectedType === 'Workout') {
      const totalReps = workoutExercises.reduce((sum, ex) => sum + (ex.sets * ex.reps), 0);
      const totalVolume = workoutExercises.reduce((sum, ex) => sum + (ex.sets * ex.reps * ex.weight), 0);
      
      summaryItems.push(
        React.createElement('p', { key: 'exercises' }, `🏋️ Exercises: ${workoutExercises.length}`)
      );
      
      if (totalReps > 0) {
        summaryItems.push(
          React.createElement('p', { key: 'total' }, `🔁 Total reps: ${totalReps}`)
        );
      }
      
      if (totalVolume > 0) {
        summaryItems.push(
          React.createElement('p', { key: 'volume' }, `📊 Total volume: ${totalVolume.toFixed(1)} kg`)
        );
      }
      
      // List all exercises
      if (workoutExercises.length > 0) {
        summaryItems.push(
          React.createElement(
            'div',
            { key: 'exercise-list', className: 'tvs-summary-exercises' },
            React.createElement('h4', null, 'Exercises:'),
            workoutExercises.map((exercise, idx) =>
              React.createElement(
                'div',
                { key: idx, className: 'tvs-summary-exercise' },
                `${idx + 1}. ${exercise.name} (${exercise.sets} × ${exercise.reps}${exercise.metric_type === 'time' ? 's' : ''}${exercise.weight > 0 ? ` @ ${exercise.weight}kg` : ''})`
              )
            )
          )
        );
      }
    } else if (selectedType === 'Swim') {
      summaryItems.push(
        React.createElement('p', { key: 'laps' }, `🏊 Laps: ${laps}`),
        React.createElement('p', { key: 'pool' }, `📏 Pool Length: ${poolLength}m`),
        React.createElement('p', { key: 'distance' }, `📍 Distance: ${(laps * poolLength / 1000).toFixed(2)} km`)
      );
      if (pace > 0) {
        summaryItems.push(
          React.createElement('p', { key: 'pace' }, `⚡ Avg Pace: ${pace} sec/lap`)
        );
      }
    } else {
      // Run, Walk, Hike, Ride
      summaryItems.push(
        React.createElement('p', { key: 'distance' }, `📍 Distance: ${distance.toFixed(2)} km`)
      );
      if (distance > 0 && elapsedTime > 0) {
        const avgSpeed = (distance / (elapsedTime / 3600)).toFixed(1);
        summaryItems.push(
          React.createElement('p', { key: 'speed' }, `⚡ Avg Speed: ${avgSpeed} km/h`)
        );
      }
      if (incline > 0) {
        summaryItems.push(
          React.createElement('p', { key: 'incline' }, `⛰️ Incline: ${incline.toFixed(1)}%`)
        );
      }
    }

    return React.createElement(
      'div',
      { className: 'tvs-manual-tracker tvs-finished', ref: containerRef },
      React.createElement('h3', null, '🎉 Activity Saved!'),
      React.createElement(
        'div',
        { className: 'tvs-summary' },
        summaryItems
      ),
      permalink && React.createElement(
        'a',
        { href: permalink, className: 'tvs-btn tvs-btn-primary' },
        'View Activity'
      ),
      activityId && React.createElement(
        'button',
        {
          className: 'tvs-btn tvs-btn-strava',
          onClick: uploadToStrava,
          disabled: uploadingToStrava
        },
        uploadingToStrava ? 'Uploading...' : '🚴 Upload to Strava'
      ),
      React.createElement(
        'button',
        {
          className: 'tvs-btn tvs-btn-secondary',
          onClick: () => {
            setStep('select');
            setSessionId(null);
            setElapsedTime(0);
            setDistance(0);
            setSpeed(0);
            setPace(0);
            setIncline(0);
            setCadence(0);
            setPower(0);
            setLaps(0);
            setSets(0);
            setReps(0);
          },
        },
        'Start Another Activity'
      )
    );
  }

  return null;
}

// Helper: Get activity icon emoji
function getActivityIcon(type) {
  const icons = {
    Run: '🏃',
    Ride: '🚴',
    Walk: '🚶',
    Hike: '🥾',
    Swim: '🏊',
    Workout: '💪',
  };
  return icons[type] || '🏃';
}
