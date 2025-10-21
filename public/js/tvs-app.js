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

  function DevOverlay({ React, routeId, lastStatus, lastError }) {
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

    const data = {
      env: window.TVS_SETTINGS?.env,
      version: window.TVS_SETTINGS?.version,
      restRoot: window.TVS_SETTINGS?.restRoot,
      user: window.TVS_SETTINGS?.user,
      routeId,
      lastStatus: lastStatus || "idle",
      lastError: lastError ? String(lastError) : null,
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
    const { useEffect, useState, createElement: h } = React;
    const [data, setData] = useState(initialData || null);
    const [error, setError] = useState(null);
    const [isPosting, setIsPosting] = useState(false);
    const [lastStatus, setLastStatus] = useState(initialData ? "inline" : "loading");
    const [lastError, setLastError] = useState(null);

    useEffect(() => {
      // For å tvinge frem loader: hvis initialData finnes men du vil SE loader, bruk ?tvsforcefetch=1
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
      })(); // FIX: fjernet ekstra krøllparentes som brøt syntaks
    }, [routeId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) return h("div", { className: "tvs-route tvs-error" }, String(error));
    if (!data) return React.createElement(Loading, null);

    const title = data.title || "Route";
    const meta = data.meta || {};
    const vimeo = meta.vimeo_id ? String(meta.vimeo_id) : "";

    async function createActivity() {
      try {
        setIsPosting(true);
        setLastStatus("posting");
        const payload = {
          route_id: data.id,
          started_at: new Date().toISOString(),
          duration_s: Number(meta.duration_s || 0),
          distance_m: Number(meta.distance_m || 0),
        };
        log("POST activity", payload, "(tvsslow:", slowParam, "ms)");
        if (slowParam) await delay(slowParam); // simuler treghet

        const r = await fetch("/wp-json/tvs/v1/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        const res = await r.json();
        log("Activity OK:", res);
        alert("Activity created: " + (res.id || JSON.stringify(res)));
        setLastStatus("ok");
      } catch (e) {
        err("Activity FAIL:", e);
        alert("Failed to create activity");
        setLastError(e?.message || String(e));
        setLastStatus("error");
      } finally { // FIX: fjernet ekstra krøllparentes før finally
        setIsPosting(false);
      }
    }

    return h(
      "div",
      { className: "tvs-app" },
      h("h2", null, title),
      vimeo
        ? h(
            "div",
            { className: "tvs-video" },
            h("iframe", {
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
      h(
        "button",
        { className: "tvs-btn", onClick: createActivity, disabled: isPosting },
        isPosting
          ? h("span", { className: "tvs-spinner", "aria-hidden": "true" })
          : null,
        isPosting ? " Starting..." : "Start activity"
      ),
      DEBUG ? h(DevOverlay, { React, routeId, lastStatus, lastError }) : null
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
