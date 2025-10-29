/* TVS Virtual Sports – React mount with debug + dev overlay (bundled entry) */
(function () {
  // ---------- helpers ----------
  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const param = (k) => new URLSearchParams(location.search).get(k);
  const DEBUG =
    new URLSearchParams(location.search).get("tvsdebug") === "1" ||
    window.TVS_DEBUG === true ||
    localStorage.getItem("tvsDev") === "1";

  if (!DEBUG) {
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "`") {
        localStorage.setItem("tvsDev", "1");
        location.reload();
      }
    });
  }

    function log(...args) {
    if (DEBUG) console.debug("[TVS]", ...args);
  }
  function err(...args) {
    console.error("[TVS]", ...args);
  }

  // ---------- React mount helper ----------
  // Always pair React with its matching renderer to avoid mismatches
  const hasWindowReact = !!(window.React && window.ReactDOM);
  const hasWpElement = !!(window.wp && window.wp.element);
  const wpEl = hasWpElement ? window.wp.element : {};
  const React = hasWindowReact ? window.React : (wpEl || {});
  const ReactDOM = hasWindowReact ? window.ReactDOM : (wpEl || null);

  // Track mounted roots to safely unmount/re-mount without DOM desyncs
  const tvsRoots = new WeakMap();

  // createRoot compatibility: use what's available from the chosen renderer
  const hasCreateRoot =
    (ReactDOM && typeof ReactDOM.createRoot === "function") ||
    (wpEl && typeof wpEl.createRoot === "function");

  function mountReact(Component, props, node) {
    try {
      // If we already mounted a root here, unmount it first to prevent React from
      // attempting to reconcile against DOM mutated elsewhere (e.g., WordPress, third-party)
      const existingRoot = tvsRoots.get(node);
      if (existingRoot && typeof existingRoot.unmount === 'function') {
        existingRoot.unmount();
        tvsRoots.delete(node);
      } else if (ReactDOM && typeof ReactDOM.unmountComponentAtNode === 'function') {
        // Legacy unmount fallback
        ReactDOM.unmountComponentAtNode(node);
      }

      if (hasCreateRoot) {
        const createRoot = (ReactDOM && ReactDOM.createRoot) || (wpEl && wpEl.createRoot);
        const root = createRoot(node);
        tvsRoots.set(node, root);
        root.render(React.createElement(Component, props));
        return;
      }
      // fallback legacy render
      const legacyRender = (ReactDOM && ReactDOM.render) || (wpEl && wpEl.render);
      if (legacyRender) {
        legacyRender(React.createElement(Component, props), node);
        return;
      }
      err("Ingen render-funksjon tilgjengelig.");
    } catch (e) {
      err("Mount feilet:", e);
    }
  }

  const slowParam = Number(new URLSearchParams(location.search).get("tvsslow") || 0);
  function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // ---------- formatTime helper ----------
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ":" + (secs < 10 ? "0" : "") + secs;
  }

  // ---------- ProgressBar component ----------
  function ProgressBar({ React, currentTime, duration }) {
    const h = React.createElement;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    
    return h(
      "div",
      { className: "tvs-progress" },
      h(
        "div",
        { className: "tvs-progress__bar" },
        h("div", {
          className: "tvs-progress__fill",
          style: { width: Math.min(progress, 100) + "%" }
        })
      ),
      h(
        "div",
        { className: "tvs-progress__time" },
        formatTime(currentTime) + " / " + formatTime(duration)
      )
    );
  }

  // ---------- Loading (spinner/skeleton) ----------
  function Loading() {
    const h = React.createElement;
    return h(
      "div",
      { className: "tvs-loading", role: "status", "aria-live": "polite" },
      // Løperen (ren inline SVG, animert via CSS)
      h(
        "svg",
        { viewBox: "0 0 64 64", className: "tvs-runner", "aria-hidden": "true" },
        // Track (bakken)
        h("line", { x1: 4, y1: 60, x2: 60, y2: 60, stroke: "#bbb", strokeWidth: 2, className: "track" }),
        // Hode
        h("circle", { cx: 26, cy: 12, r: 5, fill: "none", stroke: "#111", strokeWidth: 2 }),
        // Kropp
        h("line", { x1: 26, y1: 17, x2: 26, y2: 35, stroke: "#111", strokeWidth: 2 }),
        // Armer
        h("line", { x1: 26, y1: 22, x2: 40, y2: 18, stroke: "#111", strokeWidth: 2, className: "arm front", style: { transformOrigin: "26px 22px" } }),
        h("line", { x1: 26, y1: 22, x2: 12, y2: 26, stroke: "#111", strokeWidth: 2, className: "arm back", style: { transformOrigin: "26px 22px" } }),
        // Bein
        h("line", { x1: 26, y1: 35, x2: 40, y2: 48, stroke: "#111", strokeWidth: 2, className: "leg front", style: { transformOrigin: "26px 35px" } }),
        h("line", { x1: 26, y1: 35, x2: 16, y2: 54, stroke: "#111", strokeWidth: 2, className: "leg back", style: { transformOrigin: "26px 35px" } })
      ),
      // Skeleton–tekst
      h(
        "div",
        null,
        h("div", { className: "tvs-skel line" }),
        h("div", { className: "tvs-skel line sm" }),
        h(
          "div",
          null,
          h("span", { className: "tvs-skel block" }),
          h("span", { className: "tvs-skel block" }),
          h("span", { className: "tvs-skel block" })
        )
      )
    );
  }

  // --- DevOverlay (avansert, beholdt én versjon) ---
  function useFPS(React) {
    const { useEffect, useRef, useState } = React;
    const [fps, setFps] = useState(0);
    const lastTime = useRef(performance.now());
    const frames = useRef(0);

    useEffect(() => {
      let raf;
      const tick = (t) => {
        frames.current += 1;
        if (t - lastTime.current >= 1000) {
          setFps(frames.current);
          frames.current = 0;
          lastTime.current = t;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    return fps;
  }

  function DevOverlay({ React, routeId, lastStatus, lastError, currentTime, duration }) {
    const { useEffect, useRef, useState, createElement: h } = React;
    const fps = useFPS(React);
    const boxRef = useRef(null);
    const [min, setMin] = useState(false);
    const [pos, setPos] = useState({ x: 16, y: 16 });

    useEffect(() => {
      const el = boxRef.current;
      if (!el) return;
      let sx, sy, ox, oy, moving = false;

      function onDown(e) {
        const header = e.target.closest(".tvs-dev__header");
        if (!header) return;
        moving = true;
        sx = e.clientX;
        sy = e.clientY;
        ox = pos.x;
        oy = pos.y;
        e.preventDefault();
      }
      function onMove(e) {
        if (!moving) return;
        setPos({ x: ox + (e.clientX - sx), y: oy + (e.clientY - sy) });
      }
      function onUp() {
        moving = false;
      }

      window.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return () => {
        window.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    }, [pos]);

    const progress = duration > 0 ? ((currentTime / duration) * 100).toFixed(1) : "0.0";

    const data = {
      env: window.TVS_SETTINGS?.env,
      version: window.TVS_SETTINGS?.version,
      restRoot: window.TVS_SETTINGS?.restRoot,
      user: window.TVS_SETTINGS?.user,
      routeId,
      lastStatus: lastStatus || "idle",
      lastError: lastError ? String(lastError) : null,
      currentTime: currentTime ? currentTime.toFixed(1) : "0.0",
      duration: duration || 0,
      progress: progress + "%",
      fps,
    };

    function copy() {
      navigator.clipboard
        .writeText(
          JSON.stringify(
            {
              ...data,
              time: new Date().toISOString(),
            },
            null,
            2
          )
        )
        .catch(console.error);
    }

    return h(
      "div",
      {
        ref: boxRef,
        className: `tvs-dev ${min ? "is-min" : ""}`,
        style: { left: pos.x + "px", top: pos.y + "px" },
      },
      h(
        "div",
        { className: "tvs-dev__header" },
        h("strong", null, "TVS Dev"),
        h("div", { className: "tvs-dev__spacer" }),
        h("span", { className: "tvs-dev__pill" }, data.env || "n/a"),
        h(
          "button",
          { className: "tvs-dev__btn", onClick: () => setMin(!min), "aria-label": "Minimize" },
          "▁"
        )
      ),
      h(
        "div",
        { className: "tvs-dev__body" },
        row("Route", data.routeId ?? "n/a"),
        row("User", data.user ?? "guest"),
        row("REST", data.restRoot ?? "n/a"),
        row("Status", data.lastStatus),
        data.lastError ? row("Error", data.lastError, true) : null,
        row("Duration", data.duration + "s"),
        row("Current", data.currentTime + "s"),
        row("Progress", data.progress),
        row("FPS", String(data.fps)),
        h(
          "div",
          { className: "tvs-dev__actions" },
          h("button", { onClick: copy, className: "tvs-dev__btn" }, "Copy debug"),
          h(
            "button",
            {
              onClick: () => {
                localStorage.setItem("tvsDev", "0");
                location.reload();
              },
              className: "tvs-dev__btn tvs-dev__btn--ghost",
            },
            "Disable"
          )
        )
      )
    );

    function row(label, value, isErr) {
      return React.createElement(
        "div",
        { className: "tvs-dev__row" },
        React.createElement("span", null, label),
        React.createElement("code", { className: isErr ? "tvs-dev__err" : "" }, value)
      );
    }
  }

  // ---------- App ----------
  function App({ initialData, routeId }) {
    const { useEffect, useState, useRef, createElement: h } = React;
    const [data, setData] = useState(initialData || null);
    const [error, setError] = useState(null);
    const [isPosting, setIsPosting] = useState(false);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionStartAt, setSessionStartAt] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [uploadingId, setUploadingId] = useState(null);
    const [lastStatus, setLastStatus] = useState(initialData ? "inline" : "loading");
    const [lastError, setLastError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    
    // Flash message helper
    function showFlash(message, type = 'success') {
      window.tvsFlash(message, type);
    }

    // Load route data
    useEffect(() => {
      const forceFetch =
        new URLSearchParams(location.search).get("tvsforcefetch") === "1";

      if (data && !forceFetch) {
        log("Har inline payload, skipper fetch.", data);
        return;
      }
      if (!routeId) {
        setError("Mangler routeId – hverken inline payload eller data-route-id.");
        return;
      }

      (async () => {
        try {
          log("Henter rute via REST:", routeId, " (tvsslow:", slowParam, "ms)");
          setLastStatus("loading");
          if (slowParam) await delay(slowParam);
          const r = await fetch(
            `/wp-json/tvs/v1/routes/${encodeURIComponent(routeId)}`,
            { credentials: "same-origin" }
          );
          const json = await r.json();
          log("REST OK:", json);
          setData(json);
          setLastStatus("ok");
        } catch (e) {
          err("REST FAIL:", e);
          setError("Kunne ikke hente rutedata.");
          setLastError(e?.message || String(e));
          setLastStatus("error");
        }
      })();
    }, [routeId]);

    // Load user's activities
    useEffect(() => {
      loadActivities();
    }, []);

    async function loadActivities() {
      try {
        setLoadingActivities(true);
        const url = "/wp-json/tvs/v1/activities/me";
        const r = await fetch(url, {
          credentials: "same-origin",
          headers: {
            "X-TVS-Nonce": window.TVS_SETTINGS?.nonce || ""
          }
        });
        if (!r.ok) {
          throw new Error("Failed to load activities");
        }
        const json = await r.json();
        const activitiesData = Array.isArray(json) ? json : (json.activities || []);
        setActivities(activitiesData);
      } catch (e) {
        err("Load activities FAIL:", e);
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    }

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

          // Prime duration from API if route meta is missing
          player.getDuration().then((d) => {
            if (!Number(data?.meta?.duration_s) && typeof d === 'number' && d > 0) {
              // optional: update display only
            }
          }).catch(() => {});

          // Ready and timeupdate
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

    async function ensurePlayerReady(timeoutMs = 8000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const p = playerRef.current;
        if (p) {
          try {
            await p.ready();
            setIsPlayerReady(true);
            return p;
          } catch (e) {
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
        setLastStatus("starting");
        try {
          await player.setCurrentTime(0);
          log('Seeked to 0');
        } catch (e) {
          err('setCurrentTime failed:', e);
        }
        try {
          await player.play();
          log('Playback started');
        } catch (e) {
          err('play() failed:', e);
          showFlash('Could not start playback: ' + (e?.message || String(e)), 'error');
          throw e;
        }
        setSessionStartAt(new Date());
        setIsSessionActive(true);
        setLastStatus("running");
      } catch (e) {
        err("Start session failed:", e);
        showFlash("Player not ready yet. Please wait a moment and try again.", 'error');
        setLastStatus("error");
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
      } catch (e) {
        err('Resume session failed:', e);
        showFlash("Player not ready yet. Please wait a moment and try again.", 'error');
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
        setLastStatus("paused");
      } catch (e) {
        err('[TVS] Pause failed:', e);
        setLastStatus("error");
      }
    }

    async function finishAndSaveActivity() {
      try {
        setIsPosting(true);
        log('Finish clicked');
        const player = await ensurePlayerReady();
        setLastStatus("saving");
        try {
          await player.pause();
          log('Playback paused before save');
        } catch (e) {
          err('pause before save failed:', e);
        }
        const seconds = await player.getCurrentTime();
        const durationS = Math.max(0, Math.floor(seconds || 0));
        const startISO = sessionStartAt ? sessionStartAt.toISOString() : new Date(Date.now() - durationS * 1000).toISOString();
        const distanceM = estimateDistance(durationS);

        const payload = {
          route_id: data.id,
          route_name: data.title || "Unknown Route",
          activity_date: new Date().toISOString(),
          started_at: startISO,
          duration_s: durationS,
          distance_m: distanceM,
        };
        const nonce = window.TVS_SETTINGS?.nonce || "";

        if (slowParam) await delay(slowParam);

        const r = await fetch("/wp-json/tvs/v1/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-WP-Nonce": nonce },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const res = await r.json();
          throw new Error(res.message || `HTTP ${r.status}`);
        }
        const res = await r.json();
        showFlash("Activity saved!");
        setLastStatus("ok");
        setIsSessionActive(false);
        setSessionStartAt(null);
        await loadActivities();
        window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
      } catch (e) {
        err('[TVS] Save activity failed:', e);
        showFlash("Failed to save activity: " + (e?.message || String(e)), 'error');
        setLastError(e?.message || String(e));
        setLastStatus("error");
      } finally {
        setIsPosting(false);
      }
    }

    async function uploadToStrava(activityId) {
      try {
        setUploadingId(activityId);
        setLastStatus("uploading");
        const r = await fetch(`/wp-json/tvs/v1/activities/${activityId}/strava`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": window.TVS_SETTINGS?.nonce || ""
          },
          credentials: "same-origin",
        });
        const res = await r.json();
        if (!r.ok) {
          throw new Error(res.message || "Upload failed");
        }
        showFlash("Uploaded to Strava!");
        setLastStatus("ok");
        await loadActivities();
        window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
      } catch (e) {
        err("Strava upload FAIL:", e);
        showFlash("Failed to upload to Strava: " + (e?.message || String(e)), 'error');
        setLastError(e?.message || String(e));
        setLastStatus("error");
      } finally {
        setUploadingId(null);
      }
    }

    if (error) return h("div", { className: "tvs-route tvs-error" }, String(error));
    if (!data) return React.createElement(Loading, null);

    const title = data.title || "Route";
    const meta = data.meta || {};
    const vimeo = meta.vimeo_id ? String(meta.vimeo_id) : "";
    const duration = Number(meta.duration_s || 0);
    const isLoggedIn = !!(window.TVS_SETTINGS?.user);

    return h(
      "div",
      { className: "tvs-app" },
      h("h2", null, title),
      vimeo
        ? h(
            "div",
            { className: "tvs-video" },
            h("iframe", {
              ref: videoRef,
              width: 560,
              height: 315,
              src:
                "https://player.vimeo.com/video/" +
                encodeURIComponent(vimeo) +
                "?controls=0&title=0&byline=0&portrait=0&pip=0&playsinline=1&dnt=1&transparent=0&muted=0",
              frameBorder: 0,
              allow: "autoplay; fullscreen; picture-in-picture",
              allowFullScreen: true,
            })
          )
        : null,
      (new URLSearchParams(location.search).get("tvsdebug") === "1" || window.TVS_DEBUG === true || localStorage.getItem("tvsDev") === "1")
        ? h("div", { className: "tvs-meta" }, h("pre", null, JSON.stringify(meta, null, 2)))
        : null,
      h(ProgressBar, { React, currentTime, duration }),
      h(
        "div",
        { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        !isLoggedIn
          ? (
              h(
                "div",
                {
                  style: {
                    backgroundColor: "#fef3c7",
                    border: "1px solid #f59e0b",
                    padding: "1rem",
                    margin: "0.5rem 0 0 0",
                    borderRadius: "4px",
                    width: '100%'
                  },
                },
                h("strong", null, "⚠️ You must be logged in"),
                h(
                  "p",
                  { style: { margin: "0.5rem 0 0 0" } },
                  "Please ",
                  h("a", { href: "/login", style: { color: '#1f2937', textDecoration: 'underline' } }, "log in"),
                  " to create activities and upload to Strava. Don't have an account? ",
                  h("a", { href: "/register", style: { color: '#1f2937', textDecoration: 'underline' } }, "Register here"),
                  "."
                )
              )
            )
          : !isSessionActive
          ? (
              (currentTime > 0 && sessionStartAt && (duration === 0 || currentTime < duration - 0.5))
                ? [
                    h(
                      "button",
                      {
                        key: 'resume',
                        className: "tvs-btn",
                        onClick: resumeActivitySession,
                         disabled: isPosting || !isPlayerReady,
                      },
                      isPosting ? h("span", { className: "tvs-spinner", "aria-hidden": "true" }) : null,
                      isPosting ? " Starting..." : "Resume Activity"
                    ),
                    h(
                      "button",
                      {
                        key: 'finish',
                        className: "tvs-btn",
                        onClick: finishAndSaveActivity,
                          disabled: isPosting || !isPlayerReady,
                        style: { backgroundColor: '#10b981' }
                      },
                      isPosting ? h("span", { className: "tvs-spinner", "aria-hidden": "true" }) : null,
                      isPosting ? " Saving..." : "Finish & Save"
                    ),
                    h(
                      "button",
                      {
                        key: 'restart',
                        className: "tvs-btn",
                        onClick: startActivitySession,
                          disabled: isPosting || !isPlayerReady,
                        style: { backgroundColor: '#334155' }
                      },
                      "Restart from 0:00"
                    )
                  ]
                 : h(
                     "button",
                     {
                       className: "tvs-btn",
                        onClick: startActivitySession,
                        disabled: isPosting || !isPlayerReady,
                     },
                     isPosting ? h("span", { className: "tvs-spinner", "aria-hidden": "true" }) : null,
                     isPosting ? " Starting..." : "Start Activity"
                   )
             )
           : [
               h(
                 "button",
                 {
                   key: 'pause',
                   className: "tvs-btn",
                   onClick: pauseActivitySession,
                     disabled: isPosting || !isPlayerReady,
                   style: { backgroundColor: "#f59e0b" },
                 },
                 "Pause"
               ),
               h(
                 "button",
                 {
                   key: 'finish',
                   className: "tvs-btn",
                   onClick: finishAndSaveActivity,
                     disabled: isPosting || !isPlayerReady,
                   style: { backgroundColor: "#10b981" },
                 },
                 isPosting
                   ? h("span", { className: "tvs-spinner", "aria-hidden": "true" })
                   : null,
                 isPosting ? " Saving..." : "Finish & Save"
               )
             ]
      ),
      DEBUG ? h(DevOverlay, { React, routeId, lastStatus, lastError, currentTime, duration }) : null
    );
  }

  // MyActivities Component (shared between main app and standalone block)
  function MyActivities({ React, activities, loadingActivities, uploadToStrava, uploadingId }) {
    const { useState, createElement: h } = React;
    const [min, setMin] = useState(false);
    
    // Show only the 5 most recent activities
    const recentActivities = activities.slice(0, 5);
    
    return h(
      "div",
      {
        className: "tvs-activities-block",
        style: { marginTop: "1rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", padding: "1rem" }
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" } },
        h("h3", { style: { margin: 0, fontSize: "1.25rem" } }, "Recent Activities"),
        h(
          "button",
          {
            onClick: () => setMin(!min),
            style: { fontSize: "1.2em", background: "none", border: "none", cursor: "pointer", color: "#666" },
            "aria-label": min ? "Expand" : "Minimize"
          },
          min ? "▸" : "▾"
        )
      ),
      min
        ? null
        : loadingActivities
        ? h("p", { style: { color: "#666" } }, "Loading activities...")
        : recentActivities.length === 0
        ? h("p", { style: { color: "#666" } }, "Start a new activity when you're ready")
        : h(
            "div",
            null,
            h(
              "div",
              { className: "tvs-activities-list", style: { marginBottom: "1rem" } },
              recentActivities.map((activity) =>
                h(ActivityCard, {
                  key: activity.id,
                  activity,
                  uploadToStrava,
                  uploading: uploadingId === activity.id,
                  React,
                  compact: true
                })
              )
            ),
            h(
              "div",
              { style: { textAlign: "center", paddingTop: "0.5rem", borderTop: "1px solid #e5e7eb" } },
              h(
                "a",
                {
                  href: "/my-activities",
                  style: { color: "#2563eb", textDecoration: "none", fontSize: "0.9rem" }
                },
                "Go to my activities →"
              )
            )
          )
    );
  }

  // Activity Card Component
  function ActivityCard({ activity, uploadToStrava, uploading, React, compact, dummy }) {
    const { createElement: h } = React;
    const meta = activity.meta || {};
    const activityId = activity.id;
    
    const syncedStrava = meta._tvs_synced_strava?.[0] || meta.synced_strava?.[0];
    const stravaRemoteId = meta._tvs_strava_remote_id?.[0] || meta.strava_activity_id?.[0];
    const isSynced = syncedStrava === "1" || syncedStrava === 1;
    
    const distance = meta._tvs_distance_m?.[0] || meta.distance_m?.[0] || 0;
    const duration = meta._tvs_duration_s?.[0] || meta.duration_s?.[0] || 0;
    const routeId = meta._tvs_route_id?.[0] || meta.route_id?.[0];
    const routeName = meta._tvs_route_name?.[0] || meta.route_name?.[0] || "Unknown Route";
    const activityDate = meta._tvs_activity_date?.[0] || meta.activity_date?.[0] || activity.date || "";
    
    // Format date nicely
    let formattedDate = "";
    if (activityDate) {
      try {
        const date = new Date(activityDate);
        formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (e) {
        formattedDate = activityDate;
      }
    }
    
    const activityTitle = formattedDate ? `${routeName} (${formattedDate})` : routeName;
    
    if (compact) {
      const { useState } = React;
      const [showPopover, setShowPopover] = useState(false);
      
      if (dummy) {
        return h(
          "div",
          {
            className: "tvs-activity-card-compact",
            style: {
              padding: "0.75rem",
              marginBottom: "0.5rem",
              borderRadius: "4px",
              background: "linear-gradient(90deg, #f3f4f6 60%, #e5e7eb 100%)",
              fontSize: "0.9rem",
              position: "relative",
              opacity: 0.6,
              filter: "grayscale(0.7)",
              pointerEvents: "none"
            },
          },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" } },
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontWeight: "500", marginBottom: "0.25rem" } }, activityTitle),
              h("div", { style: { fontSize: "0.85rem", color: "#888" } },
                distance > 0 ? (distance / 1000).toFixed(2) + " km" : "",
                distance > 0 && duration > 0 ? " · " : "",
                duration > 0 ? Math.floor(duration / 60) + " min" : ""
              )
            ),
            h("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 } },
              h("span", { style: { color: "#bbb", fontSize: "1.5rem", lineHeight: 1, display: "flex", alignItems: "center" }, title: "Preview" }, "✓"),
              h("div", { style: { width: "32px", height: "32px", borderRadius: "4px", backgroundColor: "#e5e7eb", color: "#ccc", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" } }, "S")
            )
          )
        );
      }
      
      return h(
        "div",
        {
          className: "tvs-activity-card-compact",
          style: {
            padding: "0.75rem",
            marginBottom: "0.5rem",
            borderRadius: "4px",
            backgroundColor: "#f9fafb",
            fontSize: "0.9rem",
            position: "relative"
          },
        },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontWeight: "500", marginBottom: "0.25rem" } }, activityTitle),
            h("div", { style: { fontSize: "0.85rem", color: "#666" } },
              distance > 0 ? (distance / 1000).toFixed(2) + " km" : "",
              distance > 0 && duration > 0 ? " · " : "",
              duration > 0 ? Math.floor(duration / 60) + " min" : ""
            )
          ),
          h("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 } },
            isSynced
              ? h("span", { 
                  style: { 
                    color: "#10b981", 
                    fontSize: "1.5rem",
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center"
                  },
                  title: "Synced to Strava"
                }, "✓")
              : null,
            h("div", { style: { position: "relative" } },
              isSynced
                ? h(
                    "a",
                    {
                      href: stravaRemoteId ? "https://www.strava.com/activities/" + stravaRemoteId : "#",
                      target: "_blank",
                      rel: "noopener noreferrer",
                      title: "View on Strava",
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        borderRadius: "4px",
                        backgroundColor: "#fc4c02",
                        color: "white",
                        textDecoration: "none",
                        fontSize: "0.9rem",
                        fontWeight: "bold"
                      }
                    },
                    "S"
                  )
                : h(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        setShowPopover(!showPopover);
                      },
                      disabled: uploading,
                      title: "Upload to Strava",
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        borderRadius: "4px",
                        backgroundColor: uploading ? "#ccc" : "#fc4c02",
                        color: "white",
                        border: "none",
                        cursor: uploading ? "wait" : "pointer",
                        fontSize: "0.9rem",
                        fontWeight: "bold"
                      }
                    },
                    uploading ? "..." : "S"
                  ),
              showPopover && !isSynced && !uploading
                ? h(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 0.5rem)",
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
                        zIndex: 1000,
                        minWidth: "200px",
                        whiteSpace: "nowrap"
                      }
                    },
                    h("div", { style: { fontSize: "0.9rem", marginBottom: "0.5rem", color: "#374151" } }, "Upload to Strava?"),
                    h("div", { style: { display: "flex", gap: "0.5rem" } },
                      h(
                        "button",
                        {
                          onClick: (e) => {
                            e.stopPropagation();
                            setShowPopover(false);
                            uploadToStrava(activityId);
                          },
                          style: {
                            flex: 1,
                            padding: "0.5rem 0.75rem",
                            backgroundColor: "#fc4c02",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: "500"
                          }
                        },
                        "Upload"
                      ),
                      h(
                        "button",
                        {
                          onClick: (e) => {
                            e.stopPropagation();
                            setShowPopover(false);
                          },
                          style: {
                            flex: 1,
                            padding: "0.5rem 0.75rem",
                            backgroundColor: "#f3f4f6",
                            color: "#374151",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.85rem"
                          }
                        },
                        "Cancel"
                      )
                    )
                  )
                : null
            )
          )
        ),
        showPopover
          ? h("div", {
              style: {
                position: "fixed",
                inset: 0,
                zIndex: 999
              },
              onClick: () => setShowPopover(false)
            })
          : null
      );
    }
    
    return h(
      "div",
      {
        className: "tvs-activity-card",
        style: {
          border: "1px solid #ddd",
          padding: "1rem",
          marginBottom: "1rem",
          borderRadius: "4px",
          backgroundColor: isSynced ? "#f0f9ff" : "#fff"
        },
      },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("div", null,
          h("strong", null, activityTitle),
          h("div", { style: { marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" } },
            distance > 0 ? h("span", null, "Distance: " + (distance / 1000).toFixed(2) + " km ") : null,
            duration > 0 ? h("span", null, "Duration: " + Math.floor(duration / 60) + " min") : null
          )
        ),
        h("div", null,
          isSynced
            ? h(
                "div",
                { style: { textAlign: "right" } },
                h("span", { style: { color: "#10b981", fontWeight: "bold" } }, "✓ Synced to Strava"),
                stravaRemoteId
                  ? h(
                      "a",
                      {
                        href: "https://www.strava.com/activities/" + stravaRemoteId,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        style: { display: "block", marginTop: "0.25rem", fontSize: "0.85rem" }
                      },
                      "View on Strava →"
                    )
                  : null
              )
            : h(
                "button",
                {
                  className: "tvs-btn tvs-btn-strava",
                  onClick: () => uploadToStrava(activityId),
                  disabled: uploading,
                  style: {
                    backgroundColor: "#fc4c02",
                    color: "white",
                    border: "none",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
                    cursor: uploading ? "wait" : "pointer",
                    opacity: uploading ? 0.6 : 1
                  }
                },
                uploading ? "Uploading..." : "Upload to Strava"
              )
        )
      )
    );
  }

  // ---------- boot ----------
  function boot() {
    const mount = document.getElementById("tvs-app-root");
    if (mount) {
      const inline = window.tvs_route_payload || null;
      const routeId = mount.getAttribute("data-route-id") || (inline && inline.id);
      log("Boot → routeId:", routeId, "inline payload:", !!inline);
      mountReact(App, { initialData: inline, routeId }, mount);
    }

    if (window.tvsMyActivitiesMount && Array.isArray(window.tvsMyActivitiesMount)) {
      window.tvsMyActivitiesMount.forEach((mountId) => {
        const blockMount = document.getElementById(mountId);
        if (blockMount) {
          log("Mounting MyActivities block on:", mountId);
          mountReact(MyActivitiesStandalone, {}, blockMount);
        }
      });
    }
  }

  function MyActivitiesStandalone() {
    const { useState, useEffect, createElement: h } = React;
    const [activities, setActivities] = useState([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [uploadingId, setUploadingId] = useState(null);
    const isLoggedIn = !!(window.TVS_SETTINGS?.user);

    useEffect(() => {
      if (!isLoggedIn) return;
      loadActivities();
      const handleActivityUpdate = () => {
        if (DEBUG) console.info('[TVS] MyActivitiesStandalone: Received activity update event, reloading...');
        loadActivities();
      };
      window.addEventListener('tvs:activity-updated', handleActivityUpdate);
      return () => {
        window.removeEventListener('tvs:activity-updated', handleActivityUpdate);
      };
    }, []);

    async function loadActivities() {
      try {
        setLoadingActivities(true);
        const url = "/wp-json/tvs/v1/activities/me";
        const r = await fetch(url, {
          credentials: "same-origin",
          headers: {
            "X-TVS-Nonce": window.TVS_SETTINGS?.nonce || ""
          }
        });
        if (!r.ok) {
          throw new Error("Failed to load activities");
        }
        const json = await r.json();
        const activitiesData = Array.isArray(json) ? json : (json.activities || []);
        setActivities(activitiesData);
      } catch (e) {
        err("Load activities FAIL:", e);
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    }

    async function uploadToStrava(activityId) {
      try {
        setUploadingId(activityId);
        const r = await fetch(`/wp-json/tvs/v1/activities/${activityId}/strava`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": window.TVS_SETTINGS?.nonce || ""
          },
          credentials: "same-origin",
        });
        const res = await r.json();
        if (!r.ok) {
          throw new Error(res.message || "Upload failed");
        }
        window.tvsFlash("Uploaded to Strava!");
        await loadActivities();
        window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
      } catch (e) {
        err("Strava upload FAIL:", e);
        window.tvsFlash("Failed to upload to Strava: " + (e?.message || String(e)), 'error');
      } finally {
        setUploadingId(null);
      }
    }

    if (!isLoggedIn) {
      const dummyActivities = Array.from({ length: 3 }).map((_, i) => ({
        id: 'dummy-' + i,
        meta: {
          _tvs_route_name: ["Sample Route " + (i + 1)],
          _tvs_activity_date: [new Date(Date.now() - i * 86400000).toISOString()],
          _tvs_distance_m: [Math.round(5000 + Math.random() * 5000)],
          _tvs_duration_s: [Math.round(1200 + Math.random() * 1800)],
        }
      }));
      return h(
        "div",
        { className: "tvs-activities-block", style: { marginTop: "1rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", padding: "1rem" } },
        h("h3", { style: { marginTop: 0 } }, "My Activities"),
        h(
          "div",
          { className: "tvs-activities-list", style: { marginBottom: "1rem" } },
          dummyActivities.map((activity) =>
            h(ActivityCard, {
              key: activity.id,
              activity,
              React,
              compact: true,
              dummy: true
            })
          )
        ),
        h(
          "div",
          { style: { textAlign: "center", color: "#888", fontSize: "0.95rem", marginBottom: "0.5rem" } },
          "Sign in to see your recent activities."
        ),
        h(
          "div",
          { style: { textAlign: "center" } },
          h(
            "a",
            { href: "/login", style: { color: '#1f2937', textDecoration: 'underline', marginRight: 12 } },
            "Log in"
          ),
          h(
            "a",
            { href: "/register", style: { color: '#1f2937', textDecoration: 'underline' } },
            "Register"
          )
        )
      );
    }

    return h(MyActivities, { React, activities, loadingActivities, uploadToStrava, uploadingId });
  }

  // toggle overlay via ` (backtick)
  if (DEBUG) {
    log("Debug mode enabled.");
  } else {
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "`") {
        const url = new URL(location.href);
        url.searchParams.set("tvsdebug", "1");
        location.href = url.toString();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();