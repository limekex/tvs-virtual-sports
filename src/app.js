import { DEBUG, log, err } from './utils/debug.js';
import { delay, withTimeout } from './utils/async.js';
import { React } from './utils/reactMount.js';
import ProgressBar from './components/ProgressBar.js';
import { RiRunLine, RiRestartLine, RiUserLine, RiSaveLine, RiFullscreenLine, RiFullscreenExitLine, RiMapPinLine, RiFileListLine, RiArrowUpSLine, RiArrowDownSLine } from 'react-icons/ri';
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
  const videoRef = useRef(null);
  const playerRef = useRef(null);

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
    };
  }, [data]);

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
      setLastStatus('paused');
      showFlash('Activity paused');
    } catch (e) {
      err('[TVS] Pause failed:', e);
      setLastStatus('error');
    }
  }

  async function finishAndSaveActivity() {
    try {
      setIsPosting(true);
      log('Finish clicked');
      const player = await ensurePlayerReady();
      setLastStatus('saving');
      try {
        await player.pause();
        log('Playback paused before save');
      } catch (e) {
        err('pause before save failed:', e);
      }
  const seconds = await player.getCurrentTime();
  const durationS = Math.max(0, Math.floor(seconds || 0));
  const startISO = sessionStartAt ? sessionStartAt.toISOString() : new Date(Date.now() - durationS * 1000).toISOString();
  const endISO = new Date(new Date(startISO).getTime() + durationS * 1000).toISOString();
  const distanceM = estimateDistance(durationS);

      const payload = {
        route_id: data.id,
        route_name: data.title || 'Unknown Route',
        activity_date: new Date().toISOString(),
        started_at: startISO,
        ended_at: endISO,
        duration_s: durationS,
        distance_m: distanceM,
        visibility: 'private',
      };
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
      showFlash('Activity saved!');
      setLastStatus('ok');
      setIsSessionActive(false);
      setSessionStartAt(null);
      // Notify My Activities widget to refresh
      window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
    } catch (e) {
      err('[TVS] Save activity failed:', e);
      showFlash('Failed to save activity: ' + (e?.message || String(e)), 'error');
      setLastError(e?.message || String(e));
      setLastStatus('error');
    } finally {
      setIsPosting(false);
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
        { className: 'tvs-alert tvs-alert--warning' },
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
              h(
                'button',
                {
                  key: 'resume',
                  className: 'tvs-btn tvs-btn--primary',
                  onClick: resumeActivitySession,
                  disabled: isPosting || !isPlayerReady,
                  'aria-label': 'Resume activity',
                  title: 'Resume activity',
                },
                isPosting
                  ? [
                      h('span', { className: 'tvs-spinner', 'aria-hidden': 'true' }),
                      h('span', { className: 'tvs-btn__label' }, 'RESUME'),
                    ]
                  : [
                      h(RiRunLine, { 'aria-hidden': true }),
                      h('span', { className: 'tvs-btn__label' }, 'RESUME'),
                    ]
              ),
              h(
                'button',
                {
                  key: 'finish',
                  className: 'tvs-btn tvs-btn--success',
                  onClick: finishAndSaveActivity,
                  disabled: isPosting || !isPlayerReady,
                  'aria-label': 'Finish and save activity',
                  title: 'Finish and save activity',
                },
                isPosting
                  ? [
                      h('span', { className: 'tvs-spinner', 'aria-hidden': 'true' }),
                      h('span', { className: 'tvs-btn__label' }, 'SAVE'),
                    ]
                  : [
                      h(RiSaveLine, { 'aria-hidden': true }),
                      h('span', { className: 'tvs-btn__label' }, 'SAVE'),
                    ]
              ),
              h(
                'button',
                {
                  key: 'restart',
                  className: 'tvs-btn tvs-btn--outline',
                  onClick: startActivitySession,
                  disabled: isPosting || !isPlayerReady,
                  'aria-label': 'Restart from beginning',
                  title: 'Restart from beginning',
                },
                isPosting
                  ? [
                      h('span', { className: 'tvs-spinner', 'aria-hidden': 'true' }),
                      h('span', { className: 'tvs-btn__label' }, 'BEGINNING'),
                    ]
                  : [
                      h(RiRestartLine, { 'aria-hidden': true }),
                      h('span', { className: 'tvs-btn__label' }, 'BEGINNING'),
                    ]
              ),
            ]
          : h(
              'button',
              {
                className: 'tvs-btn tvs-btn--primary',
                onClick: startActivitySession,
                disabled: isPosting || !isPlayerReady,
                'aria-label': 'Start activity',
                title: 'Start activity',
              },
              isPosting
                ? [
                    h('span', { className: 'tvs-spinner', 'aria-hidden': 'true' }),
                    h('span', { className: 'tvs-btn__label' }, 'START'),
                  ]
                : [
                    h(RiRunLine, { 'aria-hidden': true }),
                    h('span', { className: 'tvs-btn__label' }, 'START'),
                  ]
            )
      )
    : [
        h(
          'button',
          {
            key: 'pause',
            className: 'tvs-btn tvs-btn--warning',
            onClick: pauseActivitySession,
            disabled: isPosting || !isPlayerReady,
            'aria-label': 'Pause activity',
            title: 'Pause activity',
          },
          h(RiUserLine, { 'aria-hidden': true }),
          h('span', { className: 'tvs-btn__label' }, 'PAUSE')
        ),
        h(
          'button',
          {
            key: 'finish',
            className: 'tvs-btn tvs-btn--success',
            onClick: finishAndSaveActivity,
            disabled: isPosting || !isPlayerReady,
            'aria-label': 'Finish and save activity',
            title: 'Finish and save activity',
          },
          isPosting
            ? [
                h('span', { className: 'tvs-spinner', 'aria-hidden': 'true' }),
                h('span', { className: 'tvs-btn__label' }, 'SAVE'),
              ]
            : [
                h(RiSaveLine, { 'aria-hidden': true }),
                h('span', { className: 'tvs-btn__label' }, 'SAVE'),
              ]
        ),
      ];

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
      isCinematicMode && showMinimap &&
        h(
          'div',
          { key: 'minimap', className: 'tvs-video-overlay tvs-video-overlay--minimap' },
          h('div', { className: 'tvs-overlay-placeholder' }, 'Mini-map')
        ),
      // Route info overlay (cinematic mode only)
      isCinematicMode && showRouteInfo &&
        h(
          'div',
          { key: 'routeinfo', className: 'tvs-video-overlay tvs-video-overlay--routeinfo' },
          h('div', { className: 'tvs-overlay-placeholder' }, 'Route Info')
        ),
      // Controls - only in normal mode
      !isCinematicMode && h(ProgressBar, { React, currentTime, duration }),
      !isCinematicMode && (new URLSearchParams(location.search).get('tvsdebug') === '1' ||
        window.TVS_DEBUG === true ||
        localStorage.getItem('tvsDev') === '1')
        ? h('div', { className: 'tvs-meta' }, h('pre', null, JSON.stringify(meta, null, 2)))
        : null,
      !isCinematicMode && h(
        'div', 
        { className: 'tvs-btns' },
        controlButtons,
        h(
          'button',
          {
            className: 'tvs-btn tvs-btn--outline tvs-cinematic-toggle',
            onClick: async () => {
              // Wait for player to be ready before entering cinematic mode
              if (!isPlayerReady) {
                showFlash('Please wait for video to load', 'warning');
                return;
              }
              
              setIsCinematicMode(true);
              
              // Try to enter native fullscreen
              try {
                const appElement = document.querySelector('.tvs-app');
                if (appElement && appElement.requestFullscreen) {
                  await appElement.requestFullscreen();
                }
              } catch (err) {
                console.warn('Fullscreen not supported or denied:', err);
              }
            },
            'aria-label': 'Enter cinematic mode',
            title: 'Enter cinematic mode (F)',
            disabled: !isPlayerReady,
          },
          h(RiFullscreenLine, { 'aria-hidden': true })
        )
      )
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
            h('div', { className: 'tvs-btns' }, controlButtons),
            h(
              'div',
              { className: 'tvs-cinematic-controls' },
              h(
                'button',
                {
                  className: 'tvs-btn tvs-btn--outline',
                  onClick: () => setShowMinimap(prev => !prev),
                  'aria-label': showMinimap ? 'Hide minimap' : 'Show minimap',
                  title: showMinimap ? 'Hide minimap' : 'Show minimap',
                },
                h(RiMapPinLine, { 'aria-hidden': true })
              ),
              h(
                'button',
                {
                  className: 'tvs-btn tvs-btn--outline',
                  onClick: () => setShowRouteInfo(prev => !prev),
                  'aria-label': showRouteInfo ? 'Hide route info' : 'Show route info',
                  title: showRouteInfo ? 'Hide route info' : 'Show route info',
                },
                h(RiFileListLine, { 'aria-hidden': true })
              ),
              h(
                'button',
                {
                  className: 'tvs-btn tvs-btn--outline tvs-exit-cinematic',
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
                  'aria-label': 'Exit cinematic mode (press F or Escape)',
                  title: 'Exit cinematic mode (press F or Escape)',
                },
                h(RiFullscreenExitLine, { 'aria-hidden': true })
              )
            )
          )
        )
      : null,
    DEBUG ? h(DevOverlay, { React, routeId, lastStatus, lastError, currentTime, duration }) : null
  );
}
