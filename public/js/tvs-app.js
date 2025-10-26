/* TVS Virtual Sports – React mount with debug + dev overlay */
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

  const slowParam = Number(new URLSearchParams(location.search).get("tvsslow") || 0);
  function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // ---------- React wiring (WP-safe) ----------
  const wpEl = (window.wp && window.wp.element) || {};
  const React = window.React || wpEl;
  const ReactDOM = window.ReactDOM || null;

  if (!React || !React.createElement) {
    err("React/ wp.element mangler. Kunne ikke mount'e appen.");
    return;
  }

  // createRoot-kompat: bruk det som finnes
  const hasCreateRoot =
    (ReactDOM && typeof ReactDOM.createRoot === "function") ||
    (wpEl && typeof wpEl.createRoot === "function");

  function mountReact(Component, props, node) {
    try {
      if (hasCreateRoot) {
        const createRoot = (ReactDOM && ReactDOM.createRoot) || wpEl.createRoot;
        const root = createRoot(node);
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
        h("line", { x1: 4, y1: 60, x2: 60, y2: 60, stroke: "#bbb", strokeWidth: 2, className: "track" }), // FIX: strokeWidth
        // Hode
        h("circle", { cx: 26, cy: 12, r: 5, fill: "none", stroke: "#111", strokeWidth: 2 }), // FIX: strokeWidth
        // Kropp
        h("line", { x1: 26, y1: 17, x2: 26, y2: 35, stroke: "#111", strokeWidth: 2 }), // FIX
        // Armer
        h("line", { x1: 26, y1: 22, x2: 40, y2: 18, stroke: "#111", strokeWidth: 2, className: "arm front", style: { transformOrigin: "26px 22px" } }), // FIX
        h("line", { x1: 26, y1: 22, x2: 12, y2: 26, stroke: "#111", strokeWidth: 2, className: "arm back", style: { transformOrigin: "26px 22px" } }), // FIX
        // Bein
        h("line", { x1: 26, y1: 35, x2: 40, y2: 48, stroke: "#111", strokeWidth: 2, className: "leg front", style: { transformOrigin: "26px 35px" } }), // FIX
        h("line", { x1: 26, y1: 35, x2: 16, y2: 54, stroke: "#111", strokeWidth: 2, className: "leg back", style: { transformOrigin: "26px 35px" } }) // FIX
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
    const [activities, setActivities] = useState([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [uploadingId, setUploadingId] = useState(null);
    const [lastStatus, setLastStatus] = useState(initialData ? "inline" : "loading");
    const [lastError, setLastError] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const videoRef = useRef(null);

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
    }, [routeId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load user's activities
    useEffect(() => {
      loadActivities();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadActivities() {
      try {
        setLoadingActivities(true);
        const r = await fetch("/wp-json/tvs/v1/activities/me", {
          credentials: "same-origin",
          headers: {
            // Use custom header to avoid WP core nonce checks blocking before our permission callback
            "X-TVS-Nonce": window.TVS_SETTINGS?.nonce || ""
          }
        });
        if (!r.ok) {
          throw new Error("Failed to load activities");
        }
        const json = await r.json();
        log("Activities loaded:", json);
        // Handle both array format and {activities: []} format
        const activitiesData = Array.isArray(json) ? json : (json.activities || []);
        setActivities(activitiesData);
      } catch (e) {
        err("Load activities FAIL:", e);
        // Set empty array on error
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    }

    // Bind to video/iframe timeupdate event
    useEffect(() => {
      if (!data) return;
      
      const video = videoRef.current;
      if (!video) return;

      function handleTimeUpdate() {
        if (video.currentTime !== undefined) {
          setCurrentTime(video.currentTime);
        }
      }

      video.addEventListener("timeupdate", handleTimeUpdate);
      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
      };
    }, [data]);

    async function createActivity() {
      try {
        // Check if user is logged in
        if (!window.TVS_SETTINGS?.user) {
          alert("You must be logged in to create an activity");
          return;
        }
        
        // Debug: Log settings
        log("TVS_SETTINGS:", window.TVS_SETTINGS);
        
        setIsPosting(true);
        setLastStatus("posting");
        const payload = {
          route_id: data.id,
          started_at: new Date().toISOString(),
          duration_s: Number(meta.duration_s || 0),
          distance_m: Number(meta.distance_m || 0),
        };
        
        const nonce = window.TVS_SETTINGS?.nonce || "";
        log("POST activity", payload, "nonce:", nonce);
        log("Headers being sent:", {
          "Content-Type": "application/json",
          "X-WP-Nonce": nonce
        });
        
        if (slowParam) await delay(slowParam);

        const r = await fetch("/wp-json/tvs/v1/activities", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-WP-Nonce": nonce
          },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        
        log("Response status:", r.status);
        log("Response headers:", Array.from(r.headers.entries()));
        
        if (!r.ok) {
          const res = await r.json();
          log("Response status:", r.status, "Response:", res);
          throw new Error(res.message || `HTTP ${r.status}: ${res.code || 'Unknown error'}`);
        }
        
        const res = await r.json();
        log("Activity OK:", res);
        alert("✓ Activity created! ID: " + res.id);
        setLastStatus("ok");
        // Reload activities list
        await loadActivities();
      } catch (e) {
        err("Activity FAIL:", e);
        alert("Failed to create activity: " + (e?.message || String(e)));
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
        log("Uploading activity", activityId, "to Strava");
        
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
        
        log("Strava upload OK:", res);
        alert("✓ Uploaded to Strava!\n" + (res.strava_url || "Activity ID: " + res.strava_id));
        setLastStatus("ok");
        
        // Reload activities to show updated sync status
        await loadActivities();
      } catch (e) {
        err("Strava upload FAIL:", e);
        alert("Failed to upload to Strava: " + (e?.message || String(e)));
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
      
      // Login warning if not authenticated
      !isLoggedIn
        ? h(
            "div",
            {
              style: {
                backgroundColor: "#fef3c7",
                border: "1px solid #f59e0b",
                padding: "1rem",
                marginBottom: "1rem",
                borderRadius: "4px",
              },
            },
            h("strong", null, "⚠️ You must be logged in"),
            h("p", { style: { margin: "0.5rem 0 0 0" } }, "Please log in to create activities and upload to Strava.")
          )
        : null,
      vimeo
        ? h(
            "div",
            { className: "tvs-video" },
            h("iframe", {
              ref: videoRef,
              width: 560,
              height: 315,
              src: "https://player.vimeo.com/video/" + encodeURIComponent(vimeo),
              frameBorder: 0,
              allow: "autoplay; fullscreen",
              allowFullScreen: true,
            })
          )
        : null,
      h("div", { className: "tvs-meta" }, h("pre", null, JSON.stringify(meta, null, 2))),
      h(ProgressBar, { React, currentTime, duration }),
      h(
        "button",
        { 
          className: "tvs-btn", 
          onClick: createActivity, 
          disabled: isPosting || !isLoggedIn 
        },
        isPosting
          ? h("span", { className: "tvs-spinner", "aria-hidden": "true" })
          : null,
        isPosting ? " Creating..." : "Start New Activity"
      ),
      
      // Activities List
      h(
        "div",
        { className: "tvs-activities", style: { marginTop: "2rem" } },
        h("h3", null, "My Activities"),
        loadingActivities
          ? h("p", null, "Loading activities...")
          : activities.length === 0
          ? h("p", null, "No activities yet. Start one above!")
          : h(
              "div",
              { className: "tvs-activities-list" },
              activities.map((activity) =>
                h(ActivityCard, {
                  key: activity.id,
                  activity,
                  uploadToStrava,
                  uploading: uploadingId === activity.id,
                  React,
                })
              )
            )
      ),
      
      DEBUG ? h(DevOverlay, { React, routeId, lastStatus, lastError, currentTime, duration }) : null
    );
  }

  // Activity Card Component
  function ActivityCard({ activity, uploadToStrava, uploading, React }) {
    const { createElement: h } = React;
    const meta = activity.meta || {};
    const activityId = activity.id;
    
    const syncedStrava = meta._tvs_synced_strava?.[0] || meta.synced_strava?.[0];
    const stravaRemoteId = meta._tvs_strava_remote_id?.[0] || meta.strava_activity_id?.[0];
    const isSynced = syncedStrava === "1" || syncedStrava === 1;
    
    const distance = meta._tvs_distance_m?.[0] || meta.distance_m?.[0] || 0;
    const duration = meta._tvs_duration_s?.[0] || meta.duration_s?.[0] || 0;
    const routeId = meta._tvs_route_id?.[0] || meta.route_id?.[0];
    
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
          h("strong", null, "Activity #" + activityId),
          routeId ? h("span", { style: { marginLeft: "0.5rem", color: "#666" } }, " (Route: " + routeId + ")") : null,
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
    if (!mount) {
      log("Ingen #tvs-app-root. Hopper over.");
      return;
    }

    const inline = window.tvs_route_payload || null;
    const routeId = mount.getAttribute("data-route-id") || (inline && inline.id);

    log("Boot → routeId:", routeId, "inline payload:", !!inline);

    mountReact(App, { initialData: inline, routeId }, mount);
  }

  // toggle overlay via ` (backtick)
  if (DEBUG) {
    log("Debug mode aktivert.");
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
