/**
 * WorkoutCircuit Component
 * 
 * Renders a single circuit with exercises, allowing add/remove/edit operations.
 * Supports both reps-based and time-based exercises.
 */

import ExerciseSearchDropdown from './ExerciseSearchDropdown.js';

const { useState } = window.React;
const React = window.React;

const WorkoutCircuit = ({
  circuit,
  isActive,
  onUpdate,
  onRemove,
  onSetActive,
  canRemove = true
}) => {
  const [currentExerciseName, setCurrentExerciseName] = useState('');
  const [currentExerciseId, setCurrentExerciseId] = useState(null);
  const [currentReps, setCurrentReps] = useState(10);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [currentMetricType, setCurrentMetricType] = useState('reps');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(circuit.name);

  const handleAddExercise = () => {
    if (!currentExerciseName.trim()) return;

    const newExercise = {
      name: currentExerciseName.trim(),
      exercise_id: currentExerciseId,
      reps: currentReps,
      weight: currentWeight,
      metric_type: currentMetricType
    };

    onUpdate({
      ...circuit,
      exercises: [...circuit.exercises, newExercise]
    });

    // Reset form
    setCurrentExerciseName('');
    setCurrentExerciseId(null);
    setCurrentReps(10);
    setCurrentWeight(0);
    setCurrentMetricType('reps');
  };

  const handleRemoveExercise = (index) => {
    onUpdate({
      ...circuit,
      exercises: circuit.exercises.filter((_, i) => i !== index)
    });
  };

  const handleUpdateSets = (sets) => {
    onUpdate({
      ...circuit,
      sets: Math.max(1, parseInt(sets) || 1)
    });
  };

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdate({
        ...circuit,
        name: editName.trim()
      });
    }
    setIsEditingName(false);
  };

  const calculateTotals = () => {
    const totalRepsPerRound = circuit.exercises.reduce((sum, ex) => {
      return sum + (ex.metric_type === 'reps' ? ex.reps : 0);
    }, 0);
    
    const totalVolumePerRound = circuit.exercises.reduce((sum, ex) => {
      return sum + (ex.reps * ex.weight);
    }, 0);

    return {
      totalReps: totalRepsPerRound * circuit.sets,
      totalVolume: totalVolumePerRound * circuit.sets
    };
  };

  const totals = calculateTotals();

  return React.createElement(
    'div',
    { 
      className: `tvs-circuit-container ${isActive ? 'tvs-circuit-active' : ''}`,
      onClick: () => !isActive && onSetActive(circuit.id)
    },
    
    // Circuit header
    React.createElement(
      'div',
      { className: 'tvs-circuit-header' },
      
      // Circuit name (editable with visual cue)
      !isEditingName 
        ? React.createElement(
            'div',
            { 
              className: 'tvs-circuit-name-wrapper',
              onClick: () => {
                setEditName(circuit.name);
                setIsEditingName(true);
              },
              title: 'Click to edit circuit name'
            },
            React.createElement('h4', { className: 'tvs-circuit-name' }, circuit.name),
            React.createElement('span', { className: 'tvs-circuit-edit-icon' }, '✎')
          )
        : React.createElement('input', {
            type: 'text',
            value: editName,
            onChange: (e) => setEditName(e.target.value),
            onBlur: handleSaveName,
            onKeyDown: (e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') {
                setEditName(circuit.name);
                setIsEditingName(false);
              }
            },
            className: 'tvs-circuit-name-edit',
            autoFocus: true
          }),
      
      // Circuit sets/rounds
      React.createElement(
        'div',
        { className: 'tvs-circuit-sets' },
        React.createElement('input', {
          type: 'number',
          value: circuit.sets,
          min: '1',
          onChange: (e) => handleUpdateSets(e.target.value),
          className: 'tvs-circuit-sets-input',
          title: 'Number of rounds'
        }),
        React.createElement('span', null, circuit.sets === 1 ? ' round' : ' rounds')
      ),
      
      // Remove circuit button
      canRemove && React.createElement(
        'button',
        {
          className: 'tvs-btn-icon tvs-circuit-remove',
          onClick: (e) => {
            e.stopPropagation();
            if (confirm(`Remove ${circuit.name}?`)) {
              onRemove(circuit.id);
            }
          },
          title: 'Remove circuit'
        },
        '✕'
      )
    ),

    // Exercise list
    circuit.exercises.length > 0 && React.createElement(
      'div',
      { className: 'tvs-circuit-exercises' },
      circuit.exercises.map((exercise, idx) =>
        React.createElement(
          'div',
          { key: idx, className: 'tvs-circuit-exercise-item' },
          React.createElement('span', { className: 'tvs-exercise-number' }, `${idx + 1}.`),
          React.createElement('span', { className: 'tvs-exercise-name' }, exercise.name),
          React.createElement(
            'span',
            { className: 'tvs-exercise-stats' },
            `${exercise.reps}${exercise.metric_type === 'time' ? 's' : ''}${exercise.weight > 0 ? ` @ ${exercise.weight}kg` : ' (bodyweight)'}`
          ),
          React.createElement(
            'button',
            {
              className: 'tvs-btn-icon',
              onClick: () => handleRemoveExercise(idx),
              title: 'Remove exercise'
            },
            '✕'
          )
        )
      )
    ),

    // Add exercise form (only show when circuit is active)
    isActive && React.createElement(
      'div',
      { className: 'tvs-circuit-add-exercise' },
      
      // Form header
      React.createElement(
        'div',
        { className: 'tvs-exercise-form-header' },
        React.createElement('label', { className: 'tvs-form-label tvs-form-label-name' }, 'Exercise'),
        React.createElement(
          'label',
          { className: 'tvs-form-label tvs-form-label-reps' },
          React.createElement(
            'span',
            { className: 'tvs-metric-type-toggle' },
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
          )
        ),
        React.createElement('label', { className: 'tvs-form-label tvs-form-label-weight' }, 'Weight (0 = bodyweight)')
      ),
      
      // Form inputs
      React.createElement(
        'div',
        { className: 'tvs-exercise-form-inputs' },
        React.createElement(ExerciseSearchDropdown, {
          value: currentExerciseName,
          onChange: (value) => {
            setCurrentExerciseName(value);
            if (currentExerciseId) setCurrentExerciseId(null);
          },
          onSelect: (exercise) => {
            setCurrentExerciseName(exercise.name);
            setCurrentExerciseId(exercise.id);
            setCurrentMetricType(exercise.default_metric || 'reps');
            if (exercise.default_metric === 'time') {
              setCurrentReps(60);
            } else {
              setCurrentReps(10);
            }
          },
          placeholder: 'Search exercise...',
          className: 'tvs-exercise-search'
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
        })
      ),
      
      // Add button (separate from grid)
      React.createElement(
        'button',
        {
          className: 'tvs-btn tvs-btn-secondary tvs-btn-add-exercise',
          onClick: handleAddExercise,
          disabled: !currentExerciseName.trim()
        },
        '+ Add'
      )
    ),

    // Circuit summary
    circuit.exercises.length > 0 && React.createElement(
      'div',
      { className: 'tvs-circuit-summary' },
      React.createElement('span', null, `${circuit.exercises.length} exercises`),
      React.createElement('span', null, '•'),
      React.createElement('span', null, `${totals.totalReps} reps`),
      totals.totalVolume > 0 && React.createElement(React.Fragment, null,
        React.createElement('span', null, '•'),
        React.createElement('span', null, `${totals.totalVolume}kg volume`)
      )
    )
  );
};

export default WorkoutCircuit;
