(() => {
  // src/utils/debug.js
  var DEBUG = new URLSearchParams(location.search).get("tvsdebug") === "1" || window.TVS_DEBUG === true || localStorage.getItem("tvsDev") === "1";
  function log(...args) {
    if (DEBUG)
      console.debug("[TVS]", ...args);
  }
  function err(...args) {
    console.error("[TVS]", ...args);
  }

  // src/utils/reactMount.js
  var hasWindowReact = !!(window.React && window.ReactDOM);
  var hasWpElement = !!(window.wp && window.wp.element);
  var wpEl = hasWpElement ? window.wp.element : {};
  var React = hasWindowReact ? window.React : wpEl || {};
  var ReactDOM = hasWindowReact ? window.ReactDOM : wpEl || null;
  var tvsRoots = /* @__PURE__ */ new WeakMap();
  var hasCreateRoot = ReactDOM && typeof ReactDOM.createRoot === "function" || wpEl && typeof wpEl.createRoot === "function";
  function mountReact(Component, props, node) {
    try {
      const existingRoot = tvsRoots.get(node);
      if (existingRoot && typeof existingRoot.unmount === "function") {
        existingRoot.unmount();
        tvsRoots.delete(node);
      } else if (ReactDOM && typeof ReactDOM.unmountComponentAtNode === "function") {
        ReactDOM.unmountComponentAtNode(node);
      }
      if (hasCreateRoot) {
        const createRoot = ReactDOM && ReactDOM.createRoot || wpEl && wpEl.createRoot;
        const root = createRoot(node);
        tvsRoots.set(node, root);
        root.render(React.createElement(Component, props));
        return;
      }
      const legacyRender = ReactDOM && ReactDOM.render || wpEl && wpEl.render;
      if (legacyRender) {
        legacyRender(React.createElement(Component, props), node);
        return;
      }
      err("Ingen render-funksjon tilgjengelig.");
    } catch (e) {
      err("Mount feilet:", e);
    }
  }

  // src/utils/async.js
  function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }
  async function withTimeout(promise, ms, label = "operation") {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(label + " timed out")), ms);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  // src/components/ProgressBar.js
  function ProgressBar({ React: React2, currentTime, duration }) {
    const h = React2.createElement;
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    const fmt = (m, s) => m + ":" + (s < 10 ? "0" : "") + s;
    const progress = duration > 0 ? currentTime / duration * 100 : 0;
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
      h("div", { className: "tvs-progress__time" }, fmt(mins, secs) + " / " + fmt(Math.floor(duration / 60), Math.floor(duration % 60)))
    );
  }

  // src/components/Loading.js
  function Loading() {
    const h = React.createElement;
    return h(
      "div",
      { className: "tvs-loading", role: "status", "aria-live": "polite" },
      h(
        "svg",
        { viewBox: "0 0 64 64", className: "tvs-runner", "aria-hidden": "true" },
        h("line", { x1: 4, y1: 60, x2: 60, y2: 60, stroke: "#bbb", strokeWidth: 2, className: "track" }),
        h("circle", { cx: 26, cy: 12, r: 5, fill: "none", stroke: "#111", strokeWidth: 2 }),
        h("line", { x1: 26, y1: 17, x2: 26, y2: 35, stroke: "#111", strokeWidth: 2 }),
        h("line", { x1: 26, y1: 22, x2: 40, y2: 18, stroke: "#111", strokeWidth: 2, className: "arm front", style: { transformOrigin: "26px 22px" } }),
        h("line", { x1: 26, y1: 22, x2: 12, y2: 26, stroke: "#111", strokeWidth: 2, className: "arm back", style: { transformOrigin: "26px 22px" } }),
        h("line", { x1: 26, y1: 35, x2: 40, y2: 48, stroke: "#111", strokeWidth: 2, className: "leg front", style: { transformOrigin: "26px 35px" } }),
        h("line", { x1: 26, y1: 35, x2: 16, y2: 54, stroke: "#111", strokeWidth: 2, className: "leg back", style: { transformOrigin: "26px 35px" } })
      ),
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

  // src/components/DevOverlay.js
  function DevOverlay({ React: React2, routeId, lastStatus, lastError, currentTime, duration }) {
    const { useEffect, useRef, useState, createElement: h } = React2;
    function useFPS(React3) {
      const { useEffect: useEffect2, useRef: useRef2, useState: useState2 } = React3;
      const [fps2, setFps] = useState2(0);
      const lastTime = useRef2(performance.now());
      const frames = useRef2(0);
      useEffect2(() => {
        let raf;
        const tick = (t) => {
          frames.current += 1;
          if (t - lastTime.current >= 1e3) {
            setFps(frames.current);
            frames.current = 0;
            lastTime.current = t;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      }, []);
      return fps2;
    }
    const fps = useFPS(React2);
    const boxRef = useRef(null);
    const [min, setMin] = useState(false);
    const [pos, setPos] = useState({ x: 16, y: 16 });
    useEffect(() => {
      const el = boxRef.current;
      if (!el)
        return;
      let sx, sy, ox, oy, moving = false;
      function onDown(e) {
        const header = e.target.closest(".tvs-dev__header");
        if (!header)
          return;
        moving = true;
        sx = e.clientX;
        sy = e.clientY;
        ox = pos.x;
        oy = pos.y;
        e.preventDefault();
      }
      function onMove(e) {
        if (!moving)
          return;
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
    const progress = duration > 0 ? (currentTime / duration * 100).toFixed(1) : "0.0";
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
      fps
    };
    function row(label, value, isErr) {
      return h(
        "div",
        { className: "tvs-dev__row" },
        h("span", null, label),
        h("code", { className: isErr ? "tvs-dev__err" : "" }, value)
      );
    }
    function copy() {
      navigator.clipboard.writeText(
        JSON.stringify({ ...data, time: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)
      ).catch(console.error);
    }
    return h(
      "div",
      { ref: boxRef, className: `tvs-dev ${min ? "is-min" : ""}`, style: { left: pos.x + "px", top: pos.y + "px" } },
      h(
        "div",
        { className: "tvs-dev__header" },
        h("strong", null, "TVS Dev"),
        h("div", { className: "tvs-dev__spacer" }),
        h("span", { className: "tvs-dev__pill" }, data.env || "n/a"),
        h("button", { className: "tvs-dev__btn", onClick: () => setMin(!min), "aria-label": "Minimize" }, "\u2581")
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
          h("button", { onClick: () => {
            localStorage.setItem("tvsDev", "0");
            location.reload();
          }, className: "tvs-dev__btn tvs-dev__btn--ghost" }, "Disable")
        )
      )
    );
  }

  // src/app.js
  var slowParam = Number(new URLSearchParams(location.search).get("tvsslow") || 0);
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
    function showFlash(message, type = "success") {
      if (typeof window.tvsFlash === "function") {
        window.tvsFlash(message, type);
      }
    }
    useEffect(() => {
      const forceFetch = new URLSearchParams(location.search).get("tvsforcefetch") === "1";
      if (data && !forceFetch) {
        log("Har inline payload, skipper fetch.", data);
        return;
      }
      if (!routeId) {
        setError("Mangler routeId \u2013 hverken inline payload eller data-route-id.");
        return;
      }
      (async () => {
        try {
          log("Henter rute via REST:", routeId, " (tvsslow:", slowParam, "ms)");
          setLastStatus("loading");
          if (slowParam)
            await delay(slowParam);
          const r = await fetch(`/wp-json/tvs/v1/routes/${encodeURIComponent(routeId)}`, {
            credentials: "same-origin"
          });
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
        const activitiesData = Array.isArray(json) ? json : json.activities || [];
        setActivities(activitiesData);
      } catch (e) {
        err("Load activities FAIL:", e);
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    }
    useEffect(() => {
      if (!data)
        return;
      const iframe = videoRef.current;
      if (!iframe)
        return;
      let player = null;
      let unsubscribed = false;
      function loadVimeoAPI() {
        return new Promise((resolve, reject) => {
          if (window.Vimeo && window.Vimeo.Player)
            return resolve();
          const existing = document.querySelector('script[src="https://player.vimeo.com/api/player.js"]');
          if (existing) {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error("Vimeo API failed to load")));
            return;
          }
          const s = document.createElement("script");
          s.src = "https://player.vimeo.com/api/player.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Vimeo API failed to load"));
          document.head.appendChild(s);
        });
      }
      (async () => {
        try {
          await loadVimeoAPI();
          if (unsubscribed)
            return;
          player = new window.Vimeo.Player(iframe);
          playerRef.current = player;
          log("Vimeo Player constructed");
          player.getDuration().catch(() => {
          });
          try {
            await player.ready();
            if (!unsubscribed) {
              setIsPlayerReady(true);
              log("Vimeo Player ready");
            }
          } catch (e) {
            err("Vimeo ready() rejected:", e);
          }
          player.on("timeupdate", (ev) => {
            if (typeof ev?.seconds === "number") {
              setCurrentTime(ev.seconds);
            }
          });
        } catch (_) {
          err("Vimeo API init failed");
        }
      })();
      return () => {
        unsubscribed = true;
        try {
          if (player && player.off)
            player.off("timeupdate");
          if (player && player.destroy)
            player.destroy();
        } catch (_) {
        }
        playerRef.current = null;
        setIsPlayerReady(false);
      };
    }, [data]);
    async function ensurePlayerReady(timeoutMs = 8e3) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const p = playerRef.current;
        if (p) {
          try {
            await p.ready();
            setIsPlayerReady(true);
            return p;
          } catch (_) {
          }
        }
        await delay(100);
      }
      throw new Error("Video player is not ready");
    }
    function estimateDistance(durationS) {
      const meta2 = data?.meta || {};
      const routeDur = Number(meta2.duration_s || 0);
      const routeDist = Number(meta2.distance_m || 0);
      if (routeDur > 0 && routeDist > 0 && durationS >= 0) {
        const ratio = Math.min(1, durationS / routeDur);
        return Math.round(routeDist * ratio);
      }
      return 0;
    }
    async function startActivitySession() {
      try {
        setIsPosting(true);
        log("Start clicked");
        const player = await ensurePlayerReady();
        setLastStatus("starting");
        try {
          await withTimeout(player.play(), 4e3, "play()");
          log("Playback started");
        } catch (e) {
          err("play() failed:", e);
          showFlash("Could not start playback: " + (e?.message || String(e)), "error");
          throw e;
        }
        try {
          const t = await withTimeout(player.getCurrentTime(), 1500, "getCurrentTime");
          if (typeof t === "number" && t > 0.5) {
            await delay(150);
            await withTimeout(player.setCurrentTime(0), 2e3, "setCurrentTime(0)");
            log("Seeked to 0");
          } else {
            log("Already at start, skipping seek");
          }
        } catch (e) {
          log("Post-play seek skipped:", e?.message || String(e));
        }
        setSessionStartAt(/* @__PURE__ */ new Date());
        setIsSessionActive(true);
        setLastStatus("running");
        showFlash("Activity started");
      } catch (e) {
        err("Start session failed:", e);
        showFlash("Player not ready yet. Please wait a moment and try again.", "error");
        setLastStatus("error");
      } finally {
        setIsPosting(false);
      }
    }
    async function resumeActivitySession() {
      try {
        setIsPosting(true);
        log("Resume clicked");
        const player = await ensurePlayerReady();
        setLastStatus("starting");
        try {
          await player.play();
          log("Playback resumed");
        } catch (e) {
          err("resume play() failed:", e);
          showFlash("Could not resume playback: " + (e?.message || String(e)), "error");
          throw e;
        }
        setIsSessionActive(true);
        setLastStatus("running");
        showFlash("Activity resumed");
      } catch (e) {
        err("Resume session failed:", e);
        showFlash("Player not ready yet. Please wait a moment and try again.", "error");
        setLastStatus("error");
      } finally {
        setIsPosting(false);
      }
    }
    async function pauseActivitySession() {
      try {
        log("Pause clicked");
        const player = await ensurePlayerReady();
        try {
          await player.pause();
          log("Playback paused");
        } catch (e) {
          err("pause() failed:", e);
          showFlash("Failed to pause: " + (e?.message || String(e)), "error");
          throw e;
        }
        setIsSessionActive(false);
        setLastStatus("paused");
        showFlash("Activity paused");
      } catch (e) {
        err("[TVS] Pause failed:", e);
        setLastStatus("error");
      }
    }
    async function finishAndSaveActivity() {
      try {
        setIsPosting(true);
        log("Finish clicked");
        const player = await ensurePlayerReady();
        setLastStatus("saving");
        try {
          await player.pause();
          log("Playback paused before save");
        } catch (e) {
          err("pause before save failed:", e);
        }
        const seconds = await player.getCurrentTime();
        const durationS = Math.max(0, Math.floor(seconds || 0));
        const startISO = sessionStartAt ? sessionStartAt.toISOString() : new Date(Date.now() - durationS * 1e3).toISOString();
        const distanceM = estimateDistance(durationS);
        const payload = {
          route_id: data.id,
          route_name: data.title || "Unknown Route",
          activity_date: (/* @__PURE__ */ new Date()).toISOString(),
          started_at: startISO,
          duration_s: durationS,
          distance_m: distanceM
        };
        const nonce = window.TVS_SETTINGS?.nonce || "";
        if (slowParam)
          await delay(slowParam);
        const r = await fetch("/wp-json/tvs/v1/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-WP-Nonce": nonce },
          credentials: "same-origin",
          body: JSON.stringify(payload)
        });
        if (!r.ok) {
          const res = await r.json();
          throw new Error(res.message || `HTTP ${r.status}`);
        }
        await r.json();
        showFlash("Activity saved!");
        setLastStatus("ok");
        setIsSessionActive(false);
        setSessionStartAt(null);
        await loadActivities();
        window.dispatchEvent(new CustomEvent("tvs:activity-updated"));
      } catch (e) {
        err("[TVS] Save activity failed:", e);
        showFlash("Failed to save activity: " + (e?.message || String(e)), "error");
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
          credentials: "same-origin"
        });
        const res = await r.json();
        if (!r.ok) {
          throw new Error(res.message || "Upload failed");
        }
        showFlash("Uploaded to Strava!");
        setLastStatus("ok");
        await loadActivities();
        window.dispatchEvent(new CustomEvent("tvs:activity-updated"));
      } catch (e) {
        err("Strava upload FAIL:", e);
        showFlash("Failed to upload to Strava: " + (e?.message || String(e)), "error");
        setLastError(e?.message || String(e));
        setLastStatus("error");
      } finally {
        setUploadingId(null);
      }
    }
    if (error)
      return h("div", { className: "tvs-route tvs-error" }, String(error));
    if (!data)
      return React.createElement(Loading, null);
    const title = data.title || "Route";
    const meta = data.meta || {};
    const vimeo = meta.vimeo_id ? String(meta.vimeo_id) : "";
    const duration = Number(meta.duration_s || 0);
    const isLoggedIn = !!window.TVS_SETTINGS?.user;
    return h(
      "div",
      { className: "tvs-app" },
      h("h2", null, title),
      vimeo ? h(
        "div",
        { className: "tvs-video" },
        h("iframe", {
          ref: videoRef,
          width: 560,
          height: 315,
          src: "https://player.vimeo.com/video/" + encodeURIComponent(vimeo) + "?controls=0&title=0&byline=0&portrait=0&pip=0&playsinline=1&dnt=1&transparent=0&muted=0",
          frameBorder: 0,
          allow: "autoplay; fullscreen; picture-in-picture",
          allowFullScreen: true
        })
      ) : null,
      new URLSearchParams(location.search).get("tvsdebug") === "1" || window.TVS_DEBUG === true || localStorage.getItem("tvsDev") === "1" ? h("div", { className: "tvs-meta" }, h("pre", null, JSON.stringify(meta, null, 2))) : null,
      h(ProgressBar, { React, currentTime, duration }),
      h(
        "div",
        { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
        !isLoggedIn ? h(
          "div",
          {
            style: {
              backgroundColor: "#fef3c7",
              border: "1px solid #f59e0b",
              padding: "1rem",
              margin: "0.5rem 0 0 0",
              borderRadius: "4px",
              width: "100%"
            }
          },
          h("strong", null, "\u26A0\uFE0F You must be logged in"),
          h(
            "p",
            { style: { margin: "0.5rem 0 0 0" } },
            "Please ",
            h("a", { href: "/login", style: { color: "#1f2937", textDecoration: "underline" } }, "log in"),
            " to create activities and upload to Strava. Don't have an account? ",
            h("a", { href: "/register", style: { color: "#1f2937", textDecoration: "underline" } }, "Register here"),
            "."
          )
        ) : !isSessionActive ? currentTime > 0 && sessionStartAt && (duration === 0 || currentTime < duration - 0.5) ? [
          h(
            "button",
            {
              key: "resume",
              className: "tvs-btn",
              onClick: resumeActivitySession,
              disabled: isPosting || !isPlayerReady
            },
            isPosting ? h("span", { className: "tvs-spinner", "aria-hidden": "true" }) : null,
            isPosting ? " Starting..." : "Resume Activity"
          ),
          h(
            "button",
            {
              key: "finish",
              className: "tvs-btn",
              onClick: finishAndSaveActivity,
              disabled: isPosting || !isPlayerReady,
              style: { backgroundColor: "#10b981" }
            },
            isPosting ? h("span", { className: "tvs-spinner", "aria-hidden": "true" }) : null,
            isPosting ? " Saving..." : "Finish & Save"
          ),
          h(
            "button",
            {
              key: "restart",
              className: "tvs-btn",
              onClick: startActivitySession,
              disabled: isPosting || !isPlayerReady,
              style: { backgroundColor: "#334155" }
            },
            "Restart from 0:00"
          )
        ] : h(
          "button",
          {
            className: "tvs-btn",
            onClick: startActivitySession,
            disabled: isPosting || !isPlayerReady
          },
          isPosting ? h("span", { className: "tvs-spinner", "aria-hidden": "true" }) : null,
          isPosting ? " Starting..." : "Start Activity"
        ) : [
          h(
            "button",
            {
              key: "pause",
              className: "tvs-btn",
              onClick: pauseActivitySession,
              disabled: isPosting || !isPlayerReady,
              style: { backgroundColor: "#f59e0b" }
            },
            "Pause"
          ),
          h(
            "button",
            {
              key: "finish",
              className: "tvs-btn",
              onClick: finishAndSaveActivity,
              disabled: isPosting || !isPlayerReady,
              style: { backgroundColor: "#10b981" }
            },
            isPosting ? h("span", { className: "tvs-spinner", "aria-hidden": "true" }) : null,
            isPosting ? " Saving..." : "Finish & Save"
          )
        ]
      ),
      DEBUG ? h(DevOverlay, { React, routeId, lastStatus, lastError, currentTime, duration }) : null
    );
  }

  // src/boot.js
  if (!DEBUG) {
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "`") {
        try {
          localStorage.setItem("tvsDev", "1");
        } catch (_) {
        }
        location.reload();
      }
    });
  }
  function boot() {
    const mount = document.getElementById("tvs-app-root");
    if (mount) {
      const inline = window.tvs_route_payload || null;
      const routeId = mount.getAttribute("data-route-id") || inline && inline.id;
      log("Boot \u2192 routeId:", routeId, "inline payload:", !!inline);
      mountReact(App, { initialData: inline, routeId }, mount);
    }
  }
  if (DEBUG) {
    log("Debug mode enabled.");
  } else {
    document.addEventListener("keydown", function(ev) {
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
//# sourceMappingURL=tvs-app.js.map
