import { DEBUG, log, err } from './utils/debug.js';
import { delay, withTimeout } from './utils/async.js';
import { React } from './utils/reactMount.js';
import ProgressBar from './components/ProgressBar.js';
import { RiPlayCircleLine, RiPauseCircleLine, RiRestartLine, RiSaveLine, RiFullscreenLine, RiFullscreenExitLine, RiMapPinLine, RiFileListLine, RiArrowUpSLine, RiArrowDownSLine } from 'react-icons/ri';
import Loading from './components/Loading.js';
import DevOverlay from './components/DevOverlay.js';
import VirtualTraining from './components/VirtualTraining.js';

const slowParam = Number(new URLSearchParams(location.search).get('tvsslow') || 0);

export default function App({ initialData, routeId }) {
  const { useEffect, useState, useRef, createElement: h } = React;
  const [data, setData] = useState(initialData || null);
  const [error, setError] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartAt, setSessionStartAt] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [lastStatus, setLastStatus] = useState(initialData ? 'inline' : 'loading');
  const [lastError, setLastError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isCinematicMode, setIsCinematicMode] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showRouteInfo, setShowRouteInfo] = useState(true);
  const [showControlPanel, setShowControlPanel] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [activityType, setActivityType] = useState('Run');
  const [actualTime, setActualTime] = useState('');
  const [actualDistance, setActualDistance] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [activityRating, setActivityRating] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const wakeLockRef = useRef(null);

  function showFlash(message, type = 'success') {
    if (typeof window.tvsFlash === 'function') {
      window.tvsFlash(message, type);
    }
  }

  // Load route data
  useEffect(() => {
    const forceFetch = new URLSearchParams(location.search).get('tvsforcefetch') === '1';

    if (data && !forceFetch) {
      log('Har inline payload, skipper fetch.', data);
      return;
    }
    if (!routeId) {
      setError('Mangler routeId – hverken inline payload eller data-route-id.');
      return;
    }

    (async () => {
      try {
        log('Henter rute via REST:', routeId, ' (tvsslow:', slowParam, 'ms)');
        setLastStatus('loading');
        if (slowParam) await delay(slowParam);
        const r = await fetch(`/wp-json/tvs/v1/routes/${encodeURIComponent(routeId)}`, {
          credentials: 'same-origin',
        });
        const json = await r.json();
        log('REST OK:', json);
        setData(json);
        setLastStatus('ok');
      } catch (e) {
        err('REST FAIL:', e);
        setError('Kunne ikke hente rutedata.');
        setLastError(e?.message || String(e));
        setLastStatus('error');
      }
    })();
  }, [routeId]);

  // Bind to Vimeo player timeupdate via API
  useEffect(() => {
    if (!data) return;

    const iframe = videoRef.current;
    if (!iframe) return;

    let player = null;
    let unsubscribed = false;

    function loadVimeoAPI() {
      return new Promise((resolve, reject) => {
        if (window.Vimeo && window.Vimeo.Player) return resolve();
        const existing = document.querySelector('script[src="https://player.vimeo.com/api/player.js"]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Vimeo API failed to load')));
          return;
        }
        const s = document.createElement('script');
        s.src = 'https://player.vimeo.com/api/player.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Vimeo API failed to load'));
        document.head.appendChild(s);
      });
    }

    (async () => {
      try {
        await loadVimeoAPI();
        if (unsubscribed) return;

        player = new window.Vimeo.Player(iframe);
        playerRef.current = player;
        log('Vimeo Player constructed');

        player.getDuration().catch(() => {});

        try {
          await player.ready();
          if (!unsubscribed) {
            setIsPlayerReady(true);
            log('Vimeo Player ready');
          }
        } catch (e) {
          err('Vimeo ready() rejected:', e);
        }
        player.on('timeupdate', (ev) => {
          if (typeof ev?.seconds === 'number') {
            setCurrentTime(ev.seconds);
          }
        });
      } catch (_) {
        err('Vimeo API init failed');
      }
    })();

    return () => {
      unsubscribed = true;
      try {
        if (player && player.off) player.off('timeupdate');
        if (player && player.destroy) player.destroy();
      } catch (_) {}
      playerRef.current = null;
      setIsPlayerReady(false);
      releaseWakeLock();
    };
  }, [data]);

  // Wake Lock helpers
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        if (DEBUG) log('Wake Lock activated');
      }
    } catch (err) {
      if (DEBUG) log('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        if (DEBUG) log('Wake Lock released');
      }
    } catch (err) {
      if (DEBUG) log('Wake Lock release error:', err);
    }
  };

  // Keyboard shortcut: F key toggles cinematic mode, Escape exits
  useEffect(() => {
    async function handleKeyPress(e) {
      // F key toggles cinematic mode
      if (e.key === 'f' || e.key === 'F') {
        // Only toggle if not typing in an input field
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          
          const newMode = !isCinematicMode;
          
          // Don't enter cinematic mode if player not ready
          if (newMode && !isPlayerReady) {
            showFlash('Please wait for video to load', 'warning');
            return;
          }
          
          setIsCinematicMode(newMode);
          
          // Handle native fullscreen
          if (newMode) {
            // Small delay to let React render the new DOM structure
            await delay(100);
            try {
              const appElement = document.querySelector('.tvs-app');
              if (appElement && appElement.requestFullscreen) {
                await appElement.requestFullscreen();
              }
            } catch (err) {
              console.warn('Fullscreen not supported or denied:', err);
            }
          } else {
            if (document.fullscreenElement) {
              try {
                await document.exitFullscreen();
              } catch (err) {
                console.warn('Error exiting fullscreen:', err);
              }
            }
          }
        }
      }
      // Escape key exits cinematic mode
      if (e.key === 'Escape' && isCinematicMode) {
        setIsCinematicMode(false);
        if (document.fullscreenElement) {
          try {
            await document.exitFullscreen();
          } catch (err) {
            console.warn('Error exiting fullscreen:', err);
          }
        }
      }
    }
    
    // Handle fullscreen change events (when user exits fullscreen via browser UI)
    function handleFullscreenChange() {
      // If user exits fullscreen via browser UI (F11, Esc), also exit cinematic mode
      if (!document.fullscreenElement && isCinematicMode) {
        setIsCinematicMode(false);
      }
    }
    
    window.addEventListener('keydown', handleKeyPress);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isCinematicMode, isPlayerReady]);

  async function ensurePlayerReady(timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const p = playerRef.current;
      if (p) {
        try {
          await p.ready();
          setIsPlayerReady(true);
          return p;
        } catch (_) {
          // keep waiting
        }
      }
      await delay(100);
    }
    throw new Error('Video player is not ready');
  }

  function estimateDistance(durationS) {
    const meta = data?.meta || {};
    const routeDur = Number(meta.duration_s || 0);
    const routeDist = Number(meta.distance_m || 0);
    if (routeDur > 0 && routeDist > 0 && durationS >= 0) {
      const ratio = Math.min(1, durationS / routeDur);
      return Math.round(routeDist * ratio);
    }
    return 0;
  }

  async function startActivitySession() {
    try {
      setIsPosting(true);
      log('Start clicked');
      const player = await ensurePlayerReady();
      setLastStatus('starting');
      try {
        await withTimeout(player.play(), 4000, 'play()');
        log('Playback started');
      } catch (e) {
        err('play() failed:', e);
        showFlash('Could not start playback: ' + (e?.message || String(e)), 'error');
        throw e;
      }
      try {
        const t = await withTimeout(player.getCurrentTime(), 1500, 'getCurrentTime');
        if (typeof t === 'number' && t > 0.5) {
          await delay(150);
          await withTimeout(player.setCurrentTime(0), 2000, 'setCurrentTime(0)');
          log('Seeked to 0');
        } else {
          log('Already at start, skipping seek');
        }
      } catch (e) {
        log('Post-play seek skipped:', e?.message || String(e));
      }
      setSessionStartAt(new Date());
      setIsSessionActive(true);
      requestWakeLock(); // Keep screen awake during activity
      setLastStatus('running');
      showFlash('Activity started');
    } catch (e) {
      err('Start session failed:', e);
      showFlash('Player not ready yet. Please wait a moment and try again.', 'error');
      setLastStatus('error');
    } finally {
      setIsPosting(false);
    }
  }

  async function resumeActivitySession() {
    try {
      setIsPosting(true);
      log('Resume clicked');
      const player = await ensurePlayerReady();
      setLastStatus('starting');
      try {
        await player.play();
        log('Playback resumed');
      } catch (e) {
        err('resume play() failed:', e);
        showFlash('Could not resume playback: ' + (e?.message || String(e)), 'error');
        throw e;
      }
      setIsSessionActive(true);
      requestWakeLock(); // Keep screen awake when resuming
      setLastStatus('running');
      showFlash('Activity resumed');
    } catch (e) {
      err('Resume session failed:', e);
      showFlash('Player not ready yet. Please wait a moment and try again.', 'error');
      setLastStatus('error');
    } finally {
      setIsPosting(false);
    }
  }

  async function pauseActivitySession() {
    try {
      log('Pause clicked');
      const player = await ensurePlayerReady();
      try {
        await player.pause();
        log('Playback paused');
      } catch (e) {
        err('pause() failed:', e);
        showFlash('Failed to pause: ' + (e?.message || String(e)), 'error');
        throw e;
      }
      setIsSessionActive(false);
      releaseWakeLock(); // Allow screen to sleep when paused
      setLastStatus('paused');
      showFlash('Activity paused');
    } catch (e) {
      err('[TVS] Pause failed:', e);
      setLastStatus('error');
    }
  }

  async function finishAndSaveActivity() {
    try {
      log('Finish clicked');
      const player = await ensurePlayerReady();
      setLastStatus('pausing');
      try {
        await player.pause();
        log('Playback paused before save dialog');
      } catch (e) {
        err('pause before save dialog failed:', e);
      }
      
      // Pre-populate modal with video data
      const seconds = await player.getCurrentTime();
      const durationS = Math.max(0, Math.floor(seconds || 0));
      const distanceM = estimateDistance(durationS);
      
      // Format for display
      const mins = Math.floor(durationS / 60);
      const secs = durationS % 60;
      setActualTime(`${mins}:${secs.toString().padStart(2, '0')}`);
      setActualDistance((distanceM / 1000).toFixed(2));
      
      // Open modal
      setShowSaveModal(true);
      
    } catch (e) {
      err('[TVS] Failed to open save dialog:', e);
      showFlash('Failed to open save dialog: ' + (e?.message || String(e)), 'error');
      setLastStatus('error');
    }
  }

  async function saveActivityFromModal() {
    try {
      setIsSaving(true);
      
      // Parse user input for time (supports H:MM:SS, MM:SS, or seconds)
      let durationS = 0;
      if (actualTime.includes(':')) {
        const parts = actualTime.split(':').map(s => parseInt(s.trim()) || 0);
        if (parts.length === 3) {
          // H:MM:SS format
          const [hours, mins, secs] = parts;
          durationS = hours * 3600 + mins * 60 + secs;
        } else if (parts.length === 2) {
          // MM:SS format
          const [mins, secs] = parts;
          durationS = mins * 60 + secs;
        } else {
          // Invalid format
          durationS = 0;
        }
      } else {
        // If just a number, treat as total seconds
        durationS = parseInt(actualTime) || 0;
      }
      
      const distanceM = Math.round(parseFloat(actualDistance) * 1000);
      
      if (distanceM <= 0 || durationS <= 0) {
        showFlash('Distance and time must be greater than zero', 'error');
        setIsSaving(false);
        return;
      }
      
      const now = new Date().toISOString();
      const startISO = sessionStartAt ? sessionStartAt.toISOString() : new Date(Date.now() - durationS * 1000).toISOString();
      const endISO = new Date(new Date(startISO).getTime() + durationS * 1000).toISOString();

      const payload = {
        route_id: data.id,
        route_name: data.title || 'Unknown Route',
        activity_date: now,
        started_at: startISO,
        ended_at: endISO,
        duration_s: durationS,
        distance_m: distanceM,
        visibility: 'private',
        activity_type: activityType,
        is_virtual: false, // Real video activity
        source: (data.meta && data.meta.video_url) ? 'video' : 'virtual' // Video mode if has video_url, otherwise virtual route
      };
      
      // Add notes and rating if provided
      if (activityNotes) {
        payload.notes = activityNotes;
      }
      if (activityRating > 0) {
        payload.rating = activityRating;
      }
      
      const nonce = window.TVS_SETTINGS?.nonce || '';

      if (slowParam) await delay(slowParam);

      const r = await fetch('/wp-json/tvs/v1/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const res = await r.json();
        throw new Error(res.message || `HTTP ${r.status}`);
      }
      await r.json();
      
      // Close modal and reset
      setShowSaveModal(false);
      setIsSaving(false);
      setActualTime('');
      setActualDistance('');
      
      showFlash('Activity saved! 🎉', 'success');
      setLastStatus('ok');
      setIsSessionActive(false);
      releaseWakeLock(); // Release wake lock after saving activity
      setSessionStartAt(null);
      
      // Notify My Activities widget to refresh
      window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
    } catch (e) {
      err('[TVS] Save activity failed:', e);
      showFlash('Failed to save activity: ' + (e?.message || String(e)), 'error');
      setLastError(e?.message || String(e));
      setLastStatus('error');
      setIsSaving(false);
    }
  }

  async function uploadToStrava(activityId) {
    try {
      setUploadingId(activityId);
      setLastStatus('uploading');
      const r = await fetch(`/wp-json/tvs/v1/activities/${activityId}/strava`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': window.TVS_SETTINGS?.nonce || '',
        },
        credentials: 'same-origin',
      });
      const res = await r.json();
      if (!r.ok) {
        throw new Error(res.message || 'Upload failed');
      }
      showFlash('Uploaded to Strava!');
      setLastStatus('ok');
      // Notify My Activities widget to refresh
      window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
    } catch (e) {
      err('Strava upload FAIL:', e);
      showFlash('Failed to upload to Strava: ' + (e?.message || String(e)), 'error');
      setLastError(e?.message || String(e));
      setLastStatus('error');
    } finally {
      setUploadingId(null);
    }
  }

  if (error) return h('div', { className: 'tvs-route tvs-error' }, String(error));
  if (!data) return React.createElement(Loading, null);

  const title = data.title || 'Route';
  const meta = data.meta || {};
  const vimeo = meta.vimeo_id ? String(meta.vimeo_id) : '';
  const gpxUrl = meta.gpx_url || '';
  const duration = Number(meta.duration_s || 0);
  const isLoggedIn = !!(window.TVS_SETTINGS?.user);

  // Check if this is a virtual training route (GPX but no video)
  if (!vimeo && gpxUrl) {
    return h(VirtualTraining, { routeData: data, routeId });
  }

  // Fallback if no video or GPX
  if (!vimeo && !gpxUrl) {
    return h('div', { className: 'tvs-route tvs-fallback' },
      h('p', null, 'This route has no video or GPX data available.')
    );
  }

  const controlButtons = !isLoggedIn
    ? h(
        'div',
        { className: 'tvs-alert tvs-alert--warning', style: { margin: '0 auto', maxWidth: '500px' } },
        h(
          'div',
          { className: 'tvs-row tvs-mb-2' },
          h('span', { className: 'tvs-badge tvs-badge-warning' }, 'Warning'),
          h('strong', null, ' You must be logged in')
        ),
        h(
          'p',
          null,
          'Please ',
          h('a', { href: '/login' }, 'log in'),
          " to create activities and upload to Strava. Don't have an account? ",
          h('a', { href: '/register' }, 'Register here'),
          '.'
        )
      )
    : !isSessionActive
    ? (
        currentTime > 0 &&
        sessionStartAt &&
        (duration === 0 || currentTime < duration - 0.5)
          ? [
              // Resume button (play icon)
              h(
                'button',
                {
                  key: 'resume',
                  className: 'control-btn',
                  onClick: resumeActivitySession,
                  disabled: isPosting || !isPlayerReady,
                  title: 'Resume activity'
                },
                h(RiPlayCircleLine, { size: 24 })
              ),
              // Save button
              h(
                'button',
                {
                  key: 'finish',
                  className: 'control-btn save-btn',
                  onClick: finishAndSaveActivity,
                  disabled: isPosting || !isPlayerReady,
                  title: 'Finish and save activity'
                },
                h(RiSaveLine, { size: 24 })
              ),
              // Restart button
              h(
                'button',
                {
                  key: 'restart',
                  className: 'control-btn',
                  onClick: startActivitySession,
                  disabled: isPosting || !isPlayerReady,
                  title: 'Restart from beginning'
                },
                h(RiRestartLine, { size: 24 })
              ),
              // Fullscreen button (only in normal mode)
              !isCinematicMode ? h(
                'button',
                {
                  key: 'fullscreen',
                  className: 'control-btn',
                  onClick: async () => {
                    if (!isPlayerReady) {
                      showFlash('Please wait for video to load', 'warning');
                      return;
                    }
                    setIsCinematicMode(true);
                    try {
                      const appElement = document.querySelector('.tvs-app');
                      if (appElement && appElement.requestFullscreen) {
                        await appElement.requestFullscreen();
                      }
                    } catch (err) {
                      console.warn('Fullscreen not supported or denied:', err);
                    }
                  },
                  disabled: !isPlayerReady,
                  title: 'Enter fullscreen mode (F)'
                },
                h(RiFullscreenLine, { size: 24 })
              ) : null
            ].filter(Boolean)
          : [
              // Start button (play icon)
              h(
                'button',
                {
                  key: 'start',
                  className: 'control-btn',
                  onClick: startActivitySession,
                  disabled: isPosting || !isPlayerReady,
                  title: 'Start activity'
                },
                h(RiPlayCircleLine, { size: 24 })
              ),
              // Fullscreen button (only in normal mode)
              !isCinematicMode ? h(
                'button',
                {
                  key: 'fullscreen',
                  className: 'control-btn',
                  onClick: async () => {
                    if (!isPlayerReady) {
                      showFlash('Please wait for video to load', 'warning');
                      return;
                    }
                    setIsCinematicMode(true);
                    try {
                      const appElement = document.querySelector('.tvs-app');
                      if (appElement && appElement.requestFullscreen) {
                        await appElement.requestFullscreen();
                      }
                    } catch (err) {
                      console.warn('Fullscreen not supported or denied:', err);
                    }
                  },
                  disabled: !isPlayerReady,
                  title: 'Enter fullscreen mode (F)'
                },
                h(RiFullscreenLine, { size: 24 })
              ) : null
            ].filter(Boolean)
      )
    : [
        // Pause button
        h(
          'button',
          {
            key: 'pause',
            className: 'control-btn',
            onClick: pauseActivitySession,
            disabled: isPosting || !isPlayerReady,
            title: 'Pause activity'
          },
          h(RiPauseCircleLine, { size: 24 })
        ),
        // Save button
        h(
          'button',
          {
            key: 'finish',
            className: 'control-btn save-btn',
            onClick: finishAndSaveActivity,
            disabled: isPosting || !isPlayerReady,
            title: 'Finish and save activity'
          },
          h(RiSaveLine, { size: 24 })
        ),
        // Fullscreen button (only in normal mode)
        !isCinematicMode ? h(
          'button',
          {
            key: 'fullscreen',
            className: 'control-btn',
            onClick: async () => {
              if (!isPlayerReady) {
                showFlash('Please wait for video to load', 'warning');
                return;
              }
              setIsCinematicMode(true);
              try {
                const appElement = document.querySelector('.tvs-app');
                if (appElement && appElement.requestFullscreen) {
                  await appElement.requestFullscreen();
                }
              } catch (err) {
                console.warn('Fullscreen not supported or denied:', err);
              }
            },
            disabled: !isPlayerReady,
            title: 'Enter fullscreen mode (F)'
          },
          h(RiFullscreenLine, { size: 24 })
        ) : null
      ].filter(Boolean);

  return h(
    'div',
    { className: `tvs-app${isCinematicMode ? ' tvs-app--cinematic' : ''}` },
    // Main content area
    h(
      'div',
      { 
        key: 'video-container',
        className: isCinematicMode ? 'tvs-video-container' : 'tvs-panel tvs-app__container'
      },
      // Video iframe
      vimeo
        ? h('div', { 
            className: isCinematicMode ? 'tvs-video tvs-video--cinematic' : 'tvs-video'
          },
            h('iframe', {
              ref: videoRef,
              width: 560,
              height: 315,
              src:
                'https://player.vimeo.com/video/' +
                encodeURIComponent(vimeo) +
                '?controls=0&title=0&byline=0&portrait=0&pip=0&playsinline=1&dnt=1&transparent=0&muted=0',
              frameBorder: 0,
              allow: 'autoplay; fullscreen; picture-in-picture',
              allowFullScreen: true,
            })
          )
        : null,
      // Minimap overlay (cinematic mode only)
      (isCinematicMode && showMinimap) ?
        h(
          'div',
          { key: 'minimap', className: 'tvs-video-overlay tvs-video-overlay--minimap' },
          h('div', { className: 'tvs-overlay-placeholder' }, 'Mini-map')
        ) : null,
      // Route info overlay (cinematic mode only)
      (isCinematicMode && showRouteInfo) ?
        h(
          'div',
          { key: 'routeinfo', className: 'tvs-video-overlay tvs-video-overlay--routeinfo' },
          h('div', { className: 'tvs-overlay-placeholder' }, 'Route Info')
        ) : null,
      // Controls - only in normal mode
      !isCinematicMode ? h(ProgressBar, { React, currentTime, duration }) : null,
      !isCinematicMode ? ((new URLSearchParams(location.search).get('tvsdebug') === '1' ||
        window.TVS_DEBUG === true ||
        localStorage.getItem('tvsDev') === '1')
        ? h('div', { className: 'tvs-meta' }, h('pre', null, JSON.stringify(meta, null, 2)))
        : null) : null,
      !isCinematicMode ? h(
        'div', 
        { className: 'training-controls' },
        controlButtons
      ) : null
    ),
    // Control panel (only in cinematic mode)
    isCinematicMode
      ? h(
          'div',
          { 
            className: `tvs-control-panel${!showControlPanel ? ' tvs-control-panel--hidden' : ''}`,
            style: duration > 0 ? { '--progress': `${Math.min((currentTime / duration) * 100, 100)}%` } : undefined
          },
          // Toggle tab (small pill that sticks up from progress bar)
          h(
            'button',
            {
              className: 'tvs-control-panel-tab',
              onClick: () => setShowControlPanel(prev => !prev),
              'aria-label': showControlPanel ? 'Hide controls' : 'Show controls',
              title: showControlPanel ? 'Hide controls' : 'Show controls',
            },
            h(showControlPanel ? RiArrowDownSLine : RiArrowUpSLine, { 'aria-hidden': true })
          ),
          // Panel content (slides down when hidden)
          h(
            'div',
            { className: 'tvs-control-panel-content' },
            h('div', { className: 'training-controls', style: { position: 'relative', bottom: 'auto', left: 'auto', transform: 'none' } }, controlButtons),
            h(
              'div',
              { className: 'tvs-cinematic-extras', style: { display: 'flex', gap: '12px', marginLeft: 'auto' } },
              h(
                'button',
                {
                  className: 'control-btn',
                  onClick: () => setShowMinimap(prev => !prev),
                  title: showMinimap ? 'Hide minimap' : 'Show minimap',
                },
                h(RiMapPinLine, { size: 24 })
              ),
              h(
                'button',
                {
                  className: 'control-btn',
                  onClick: () => setShowRouteInfo(prev => !prev),
                  title: showRouteInfo ? 'Hide route info' : 'Show route info',
                },
                h(RiFileListLine, { size: 24 })
              ),
              h(
                'button',
                {
                  className: 'control-btn',
                  onClick: async () => {
                    setIsCinematicMode(false);
                    if (document.fullscreenElement) {
                      try {
                        await document.exitFullscreen();
                      } catch (err) {
                        console.warn('Error exiting fullscreen:', err);
                      }
                    }
                  },
                  title: 'Exit cinematic mode (press F or Escape)',
                },
                h(RiFullscreenExitLine, { size: 24 })
              )
            )
          )
        )
      : null,
    DEBUG ? h(DevOverlay, { React, routeId, lastStatus, lastError, currentTime, duration }) : null,
    
    // Save Activity Modal
    showSaveModal ? h('div', { className: 'save-modal-overlay', onClick: () => setShowSaveModal(false) },
      h('div', { className: 'save-modal', onClick: (e) => e.stopPropagation() },
        h('h3', null, '💾 Save Activity'),
        h('p', null, `Enter actual data from your ${activityType === 'Ride' ? 'bike/trainer' : 'treadmill'}:`),
        
        // Activity Type Selector
        h('div', { className: 'modal-field' },
          h('label', null, 'Activity Type'),
          h('div', { className: 'activity-type-selector', style: { display: 'flex', gap: '8px', marginTop: '8px' } },
            ['Walk', 'Run', 'Ride'].map(type => 
              h('button', {
                key: type,
                type: 'button',
                className: `activity-type-btn ${activityType === type ? 'active' : ''}`,
                onClick: () => setActivityType(type),
                style: {
                  flex: 1,
                  padding: '12px',
                  border: activityType === type ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  background: activityType === type ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s'
                }
              }, [
                h('span', { key: 'icon', style: { fontSize: '24px' } }, 
                  type === 'Walk' ? '🚶' : type === 'Run' ? '🏃' : '🚴'
                ),
                h('span', { key: 'label', style: { fontSize: '14px', fontWeight: activityType === type ? '600' : '400' } }, type)
              ])
            )
          )
        ),
        
        // Distance and Time in one row
        h('div', { className: 'modal-fields-row' },
          h('div', { className: 'modal-field' },
            h('label', null, 'Distance (km)'),
            h('input', {
              type: 'text',
              value: actualDistance,
              onChange: (e) => setActualDistance(e.target.value),
              placeholder: '8.234'
            }),
            h('small', null, 'e.g., 8.234 km')
          ),
          
          h('div', { className: 'modal-field' },
            h('label', null, 'Time'),
            h('input', {
              type: 'text',
              value: actualTime,
              onChange: (e) => setActualTime(e.target.value),
              placeholder: '1:23:45'
            }),
            h('small', null, 'H:MM:SS or MM:SS')
          )
        ),
        
        // Notes field
        h('div', { className: 'modal-field' },
          h('label', null, 'Notes (optional)'),
          h('textarea', {
            value: activityNotes,
            onChange: (e) => setActivityNotes(e.target.value),
            placeholder: 'How did the activity feel? Any observations?',
            rows: 2
          })
        ),
        
        // Rating field
        h('div', { className: 'modal-field' },
          h('label', null, 'Rate Your Activity (1-10, optional)'),
          h('div', { className: 'tvs-rating-scale' },
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => 
              h('button', {
                key: rating,
                type: 'button',
                onClick: () => setActivityRating(rating),
                className: `tvs-rating-btn ${activityRating === rating ? 'tvs-rating-btn--active' : ''}`
              }, rating)
            )
          ),
          activityRating > 0 ? h('div', { className: 'tvs-rating-label' },
            activityRating <= 3 ? 'Challenging' : activityRating <= 6 ? 'Moderate' : activityRating <= 8 ? 'Good' : 'Excellent'
          ) : null
        ),
        
        h('div', { className: 'modal-buttons' },
          h('button', {
            className: 'btn-secondary',
            onClick: () => {
              setShowSaveModal(false);
              setActualTime('');
              setActualDistance('');
            },
            disabled: isSaving
          }, 'Cancel'),
          
          h('button', {
            className: 'btn-primary',
            onClick: saveActivityFromModal,
            disabled: isSaving
          }, isSaving ? 'Saving...' : 'Save Activity')
        )
      )
    ) : null
  );
}
